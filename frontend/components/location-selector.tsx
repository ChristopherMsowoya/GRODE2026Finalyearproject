"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { MapPin, ChevronDown, Search, Loader2, AlertCircle } from "lucide-react"
import malawiAdminData from "@/lib/data/malawiAdministrativeData.json"
import { fetchLocationHierarchy, fetchTaGrids, searchLocations } from "@/lib/algorithm-api"

interface TaOption {
  ta: string
  grid_cell_count: number
  overall_risk_level: "Low" | "Medium" | "High"
  average_false_onset_probability: number
  average_dry_spell_probability: number
}

interface DistrictOption {
  district: string
  ta_count: number
  traditional_authorities: TaOption[]
}

export interface GridOption {
  grid_id: string
  area_name?: string | null
  area_place_type?: string | null
  area_latitude?: number | null
  area_longitude?: number | null
  latitude: number
  longitude: number
  overall_risk_level: "Low" | "Medium" | "High"
  false_onset_probability: number
  dry_spell_probability: number
  onset_probability?: number | null
  seasons_analyzed: number
  seasons_with_detected_onset: number
  first_detected_onset_date: string | null
  latest_detected_onset_date: string | null
  false_onset_interpretation: string
  dry_spell_interpretation: string
}

export interface SelectedLocation {
  district: string
  ta: string | null
  taData: TaOption | null
  grid: string | null
  gridData: GridOption | null
  areaName: string | null
}

interface LocationSelectorProps {
  onLocationChange: (location: SelectedLocation) => void
  defaultDistrict?: string
}

const RISK_COLORS = {
  Low: { text: "#1F7A63", bg: "rgba(31,122,99,0.12)", border: "rgba(31,122,99,0.3)" },
  Medium: { text: "#F4A261", bg: "rgba(244,162,97,0.12)", border: "rgba(244,162,97,0.3)" },
  High: { text: "#D64545", bg: "rgba(214,69,69,0.12)", border: "rgba(214,69,69,0.3)" },
}

export default function LocationSelector({ onLocationChange, defaultDistrict = "Lilongwe" }: LocationSelectorProps) {
  const [hierarchy, setHierarchy] = useState<DistrictOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedDistrict, setSelectedDistrict] = useState<string>(defaultDistrict)
  const [selectedTA, setSelectedTA] = useState<string>("")
  const [selectedArea, setSelectedArea] = useState<string>("")
  
  const [districtOpen, setDistrictOpen] = useState(false)
  const [taOpen, setTaOpen] = useState(false)
  const [areaOpen, setAreaOpen] = useState(false)

  const [districtSearch, setDistrictSearch] = useState("")
  const [taSearch, setTaSearch] = useState("")
  const [areaSearch, setAreaSearch] = useState("")
  
  const [globalSearch, setGlobalSearch] = useState("")
  const [globalResults, setGlobalResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchGridSelection, setSearchGridSelection] = useState<SelectedLocation | null>(null)

  const [gridsLoading, setGridsLoading] = useState(false)
  const [taGrids, setTaGrids] = useState<GridOption[]>([])
  
  // Debounce timer ref for search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastEmittedSelectionRef = useRef<string>("")

  // Load hierarchy on mount — fall back to static admin data if backend offline
  useEffect(() => {
    const controller = new AbortController()

    const buildFallbackHierarchy = () => {
      // Build hierarchy from malawiAdministrativeData.json
      return (malawiAdminData.districts || []).map((d: any) => ({
        district: d.name,
        ta_count: (d.traditionalAuthorities || []).length,
        traditional_authorities: (d.traditionalAuthorities || []).map((ta: any) => ({
          ta: ta.name,
          grid_cell_count: (ta.areas || []).length || 1,
          overall_risk_level: "Low" as const,
          average_false_onset_probability: 0,
          average_dry_spell_probability: 0,
        })),
      }))
    }

    const fetchHierarchy = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchLocationHierarchy(controller.signal)
        if (controller.signal.aborted) return
        if ((data.districts || []).length > 0) {
          setHierarchy(data.districts)
          setError(null)
        } else {
          // Backend returned empty — use static fallback silently
          setHierarchy(buildFallbackHierarchy())
          setError("offline")
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          console.warn("Hierarchy fetch warning:", e)
          setHierarchy(buildFallbackHierarchy())
          setError("offline")
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchHierarchy()

    return () => controller.abort()
  }, [])

  // Load grids when TA is selected
  useEffect(() => {
    if (!selectedTA) {
      setTaGrids([])
      setSelectedArea("")
      return
    }

    const controller = new AbortController()

    const fetchGrids = async () => {
      setGridsLoading(true)
      try {
        const data = await fetchTaGrids(selectedDistrict, selectedTA, controller.signal)
        if (controller.signal.aborted) return
        setTaGrids((data.grids || []) as unknown as GridOption[])
      } catch (e) {
        if (!controller.signal.aborted) {
          console.warn("Grid fetch warning:", e)
          setTaGrids([])
        }
      } finally {
        if (!controller.signal.aborted) setGridsLoading(false)
      }
    }
    fetchGrids()

    return () => controller.abort()
  }, [selectedTA, selectedDistrict])

  // Memoize derived values to prevent circular dependencies
  const currentDistrict = useMemo(
    () => hierarchy.find(d => d.district === selectedDistrict),
    [hierarchy, selectedDistrict]
  )
  
  const currentTas = useMemo(
    () => currentDistrict?.traditional_authorities || [],
    [currentDistrict]
  )
  
  const currentTaData = useMemo(
    () => currentTas.find(t => t.ta === selectedTA) || null,
    [currentTas, selectedTA]
  )

  // Area names come from the backend spatial source. Fall back to the grid ID
  // instead of pairing unrelated static names by array position.
  const gridAreaOptions = useMemo(
    () => taGrids.map((grid, index) => {
      const areaName = grid.area_name || `Grid ${grid.grid_id || index + 1}`
      return { ...grid, areaName }
    }),
    [taGrids]
  )

  const filteredDistricts = useMemo(
    () => hierarchy.filter(d => d.district.toLowerCase().includes(districtSearch.toLowerCase())),
    [hierarchy, districtSearch]
  )
  
  const filteredTas = useMemo(
    () => currentTas.filter(t => t.ta.toLowerCase().includes(taSearch.toLowerCase())),
    [currentTas, taSearch]
  )
  
  const filteredAreas = useMemo(
    () => gridAreaOptions.filter(g => 
      g.areaName.toLowerCase().includes(areaSearch.toLowerCase()) || 
      g.grid_id.toLowerCase().includes(areaSearch.toLowerCase())
    ),
    [gridAreaOptions, areaSearch]
  )

  const areaNameCounts = useMemo(
    () => gridAreaOptions.reduce<Record<string, number>>((counts, grid) => {
      counts[grid.areaName] = (counts[grid.areaName] || 0) + 1
      return counts
    }, {}),
    [gridAreaOptions]
  )

  const currentGridData = useMemo(
    () => gridAreaOptions.find(g => g.grid_id === selectedArea) || null,
    [gridAreaOptions, selectedArea]
  )

  const selectionKey = useCallback((location: SelectedLocation) => {
    return [
      location.district,
      location.ta || "",
      location.grid || "",
      location.areaName || "",
      location.taData?.grid_cell_count ?? "",
      location.gridData?.latitude ?? "",
      location.gridData?.longitude ?? "",
      location.gridData?.false_onset_probability ?? "",
      location.gridData?.dry_spell_probability ?? "",
      location.gridData?.onset_probability ?? "",
    ].join("|")
  }, [])

  // Notify parent when selection changes - duplicate guards prevent recursive update loops.
  useEffect(() => {
    const payload: SelectedLocation = searchGridSelection &&
      selectedDistrict === searchGridSelection.district &&
      selectedTA === "" &&
      selectedArea === ""
      ? searchGridSelection
      : {
      district: selectedDistrict,
      ta: selectedTA || null,
      taData: currentTaData,
      grid: currentGridData ? currentGridData.grid_id : null,
      gridData: currentGridData || null,
      areaName: currentGridData?.areaName || null,
    }

    const key = selectionKey(payload)
    if (lastEmittedSelectionRef.current === key) return
    lastEmittedSelectionRef.current = key
    onLocationChange(payload)
  }, [
    selectedDistrict,
    selectedTA,
    selectedArea,
    currentTaData,
    currentGridData,
    searchGridSelection,
    onLocationChange,
    selectionKey,
  ])

  // Memoized event handlers
  const handleDistrictSelect = useCallback((district: string) => {
    setSearchGridSelection(null)
    setSelectedDistrict(district)
    setSelectedTA("")
    setSelectedArea("")
    setDistrictOpen(false)
    setDistrictSearch("")
  }, [])

  const handleTaSelect = useCallback((ta: string) => {
    setSearchGridSelection(null)
    setSelectedTA(ta)
    setSelectedArea("")
    setTaOpen(false)
    setTaSearch("")
  }, [])

  const handleAreaSelect = useCallback((gridId: string) => {
    setSearchGridSelection(null)
    setSelectedArea(gridId)
    setAreaOpen(false)
    setAreaSearch("")
  }, [])

  // Debounced global search with abort control
  const handleGlobalSearch = useCallback(async (query: string) => {
    setGlobalSearch(query)
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (query.trim().length < 2) {
      setGlobalResults([])
      setSearchOpen(false)
      return
    }

    setSearchOpen(true)
    
    // Debounce the search request
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      abortControllerRef.current = new AbortController()
      
      try {
        const data = await searchLocations(query, 8, abortControllerRef.current.signal)
        setGlobalResults(data.locations || [])
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError") {
          console.warn("Search warning:", e)
        }
      } finally {
        setIsSearching(false)
      }
    }, 400) // 400ms debounce
  }, [])

  const handleGlobalSelect = useCallback((place: any) => {
    setGlobalSearch("")
    setSearchOpen(false)
    setGlobalResults([])
    
    if (place.place_type === "Grid Cell") {
      const gridSelection: SelectedLocation = {
        district: place.district || selectedDistrict,
        ta: place.traditional_authority || null,
        taData: null,
        grid: place.grid_id,
        gridData: {
          grid_id: place.grid_id,
          area_name: place.location_name,
          latitude: place.latitude,
          longitude: place.longitude,
          overall_risk_level: "Low",
          false_onset_probability: 0,
          dry_spell_probability: 0,
          seasons_analyzed: 0,
          seasons_with_detected_onset: 0,
          first_detected_onset_date: null,
          latest_detected_onset_date: null,
          false_onset_interpretation: "",
          dry_spell_interpretation: "",
        },
        areaName: place.location_name
      }
      setSearchGridSelection(gridSelection)
      setSelectedDistrict(place.district || selectedDistrict)
      setSelectedTA("")
      setSelectedArea("")
    } else {
      setSearchGridSelection(null)
      setSelectedDistrict(place.district || selectedDistrict)
      if (place.traditional_authority) {
        setSelectedTA(place.traditional_authority)
      } else {
        setSelectedTA("")
      }
      setSelectedArea("")
    }
  }, [selectedDistrict, onLocationChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] text-[#6b7a8d]"
        style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading locations...
      </div>
    )
  }

  const risk = currentTaData?.overall_risk_level || "Low"
  const riskColor = RISK_COLORS[risk]

  return (
    <div className="flex flex-col gap-2">
      {error === "offline" && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-[#92400e] bg-[#fef3c7] border border-[#fde68a] w-fit">
          <AlertCircle className="h-3 w-3" />
          Backend offline — showing static location list. Grid cell data unavailable.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
      {/* Global Search */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all w-64"
             style={{ background: "white", border: "1.5px solid #e2e8f0", boxShadow: searchOpen ? "0 0 0 3px rgba(15,42,61,0.08)" : "none" }}>
          <Search className="h-4 w-4 text-[#6b7a8d]" />
          <input
            value={globalSearch}
            onChange={(e) => handleGlobalSearch(e.target.value)}
            onFocus={() => { if (globalResults.length > 0) setSearchOpen(true) }}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            placeholder="Search District, TA, Grid..."
            className="w-full bg-transparent text-[13px] outline-none text-[#0F2A3D] placeholder-[#b0bac7]"
          />
          {isSearching && <Loader2 className="h-4 w-4 animate-spin text-[#6b7a8d]" />}
        </div>
        {searchOpen && globalResults.length > 0 && (
          <div className="absolute top-full left-0 z-50 mt-1.5 w-72 max-h-60 overflow-y-auto rounded-2xl bg-white"
               style={{ boxShadow: "0 8px 32px -4px rgba(15,42,61,0.18), 0 0 0 1px #e2e8f0" }}>
            <div className="p-2 flex flex-col">
              {globalResults.map((r, idx) => (
                <button
                  key={`${r.grid_id || r.location_name}-${r.district}-${r.place_type}-${idx}`}
                  onMouseDown={() => handleGlobalSelect(r)}
                  className="flex flex-col items-start px-3 py-2 rounded-xl hover:bg-[#f8fafc] text-left transition-colors"
                >
                  <span className="text-[13px] font-bold text-[#0F2A3D]">{r.location_name}</span>
                  <span className="text-[11px] text-[#6b7a8d] font-medium">{r.district} • {r.place_type}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-6 w-px bg-[#e2e8f0] hidden sm:block"></div>

      {/* Location pin label */}
      <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-[#6b7a8d]">
        <MapPin className="h-3.5 w-3.5" />
        Filter:
      </div>
      <div className="relative">
        <button
          id="district-selector"
          onClick={() => { setDistrictOpen(v => !v); setTaOpen(false) }}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all"
          style={{
            background: "white",
            border: "1.5px solid #e2e8f0",
            color: "#0F2A3D",
            boxShadow: districtOpen ? "0 0 0 3px rgba(15,42,61,0.08)" : "none"
          }}
        >
          <span className="max-w-[140px] truncate">{selectedDistrict} District</span>
          <ChevronDown className={`h-3.5 w-3.5 text-[#6b7a8d] transition-transform ${districtOpen ? "rotate-180" : ""}`} />
        </button>

        {districtOpen && (
          <div
            className="absolute top-full left-0 z-50 mt-1.5 w-60 rounded-2xl overflow-hidden"
            style={{ background: "white", boxShadow: "0 8px 32px -4px rgba(15,42,61,0.18), 0 0 0 1px #e2e8f0" }}
          >
            {/* Search */}
            <div className="p-2 border-b border-[#f0f4f8]">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "#f8fafc" }}>
                <Search className="h-3.5 w-3.5 text-[#6b7a8d]" />
                <input
                  autoFocus
                  value={districtSearch}
                  onChange={e => setDistrictSearch(e.target.value)}
                  placeholder="Search districts..."
                  className="flex-1 bg-transparent text-[12px] outline-none text-[#0F2A3D] placeholder-[#b0bac7]"
                />
              </div>
            </div>
            {/* List */}
            <div className="max-h-56 overflow-y-auto py-1">
              {filteredDistricts.map(d => (
                <button
                  key={d.district}
                  onClick={() => handleDistrictSelect(d.district)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] text-left transition-colors hover:bg-[#f8fafc]"
                  style={{ color: d.district === selectedDistrict ? "#1F7A63" : "#0F2A3D", fontWeight: d.district === selectedDistrict ? 700 : 500 }}
                >
                  <span>{d.district}</span>
                  <span className="text-[11px] text-[#6b7a8d]">{d.ta_count} TAs</span>
                </button>
              ))}
              {filteredDistricts.length === 0 && (
                <p className="px-4 py-3 text-[12px] text-[#6b7a8d]">No districts found</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TA Dropdown */}
      <div className="relative">
        <button
          id="ta-selector"
          onClick={() => { setTaOpen(v => !v); setDistrictOpen(false); setAreaOpen(false) }}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all"
          style={{
            background: selectedTA ? "white" : "#f8fafc",
            border: "1.5px solid #e2e8f0",
            color: selectedTA ? "#0F2A3D" : "#9aa5b1",
            boxShadow: taOpen ? "0 0 0 3px rgba(15,42,61,0.08)" : "none"
          }}
        >
          <span className="max-w-[140px] truncate">
            {selectedTA ? `TA ${selectedTA}` : "All TAs"}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-[#6b7a8d] transition-transform ${taOpen ? "rotate-180" : ""}`} />
        </button>

        {taOpen && (
          <div
            className="absolute top-full left-0 z-50 mt-1.5 w-64 rounded-2xl overflow-hidden"
            style={{ background: "white", boxShadow: "0 8px 32px -4px rgba(15,42,61,0.18), 0 0 0 1px #e2e8f0" }}
          >
            {/* Search */}
            <div className="p-2 border-b border-[#f0f4f8]">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "#f8fafc" }}>
                <Search className="h-3.5 w-3.5 text-[#6b7a8d]" />
                <input
                  autoFocus
                  value={taSearch}
                  onChange={e => setTaSearch(e.target.value)}
                  placeholder="Search traditional authorities..."
                  className="flex-1 bg-transparent text-[12px] outline-none text-[#0F2A3D] placeholder-[#b0bac7]"
                />
              </div>
            </div>
            {/* All TAs option */}
            <div className="max-h-64 overflow-y-auto py-1">
              <button
                onClick={() => { setSelectedTA(""); setSelectedArea(""); setTaOpen(false) }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] text-left transition-colors hover:bg-[#f8fafc]"
                style={{ color: !selectedTA ? "#1F7A63" : "#6b7a8d", fontWeight: !selectedTA ? 700 : 400 }}
              >
                <span>All TAs in {selectedDistrict}</span>
              </button>
              <div className="mx-3 my-1 border-t border-[#f0f4f8]" />
              {filteredTas.map((t, idx) => {
                const rc = RISK_COLORS[t.overall_risk_level]
                return (
                  <button
                    key={`${selectedDistrict}-${t.ta}-${idx}`}
                    onClick={() => handleTaSelect(t.ta)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] text-left transition-colors hover:bg-[#f8fafc]"
                    style={{ color: t.ta === selectedTA ? "#1F7A63" : "#0F2A3D", fontWeight: t.ta === selectedTA ? 700 : 500 }}
                  >
                    <span className="truncate max-w-[150px]">{t.ta}</span>
                    <span
                      className="ml-2 flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color: rc.text, background: rc.bg }}
                    >
                      {t.overall_risk_level}
                    </span>
                  </button>
                )
              })}
              {filteredTas.length === 0 && (
                <p className="px-4 py-3 text-[12px] text-[#6b7a8d]">No TAs found</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Area Dropdown (Only visible when TA is selected) */}
      {selectedTA && (
        <div className="relative">
          <button
            id="area-selector"
            onClick={() => { setAreaOpen(v => !v); setDistrictOpen(false); setTaOpen(false) }}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all"
            style={{
              background: selectedArea ? "white" : "#f8fafc",
              border: "1.5px solid #e2e8f0",
              color: selectedArea ? "#0F2A3D" : "#9aa5b1",
              boxShadow: areaOpen ? "0 0 0 3px rgba(15,42,61,0.08)" : "none"
            }}
          >
            {gridsLoading ? (
               <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <span className="max-w-[140px] truncate">
                  {currentGridData?.areaName || "Select Area"}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-[#6b7a8d] transition-transform ${areaOpen ? "rotate-180" : ""}`} />
              </>
            )}
          </button>

          {areaOpen && !gridsLoading && (
            <div
              className="absolute top-full left-0 z-50 mt-1.5 w-64 rounded-2xl overflow-hidden"
              style={{ background: "white", boxShadow: "0 8px 32px -4px rgba(15,42,61,0.18), 0 0 0 1px #e2e8f0" }}
            >
              {/* Search */}
              <div className="p-2 border-b border-[#f0f4f8]">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "#f8fafc" }}>
                  <Search className="h-3.5 w-3.5 text-[#6b7a8d]" />
                  <input
                    autoFocus
                    value={areaSearch}
                    onChange={e => setAreaSearch(e.target.value)}
                    placeholder="Search Areas..."
                    className="flex-1 bg-transparent text-[12px] outline-none text-[#0F2A3D] placeholder-[#b0bac7]"
                  />
                </div>
              </div>
              {/* All Areas option */}
              <div className="max-h-64 overflow-y-auto py-1">
                <button
                  onClick={() => { setSelectedArea(""); setAreaOpen(false) }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] text-left transition-colors hover:bg-[#f8fafc]"
                  style={{ color: !selectedArea ? "#1F7A63" : "#6b7a8d", fontWeight: !selectedArea ? 700 : 400 }}
                >
                  <span>All Areas in TA {selectedTA}</span>
                </button>
                <div className="mx-3 my-1 border-t border-[#f0f4f8]" />
                {filteredAreas.map(g => {
                  const rc = RISK_COLORS[g.overall_risk_level || "Low"]
                  return (
                    <button
                      key={g.grid_id}
                      onClick={() => handleAreaSelect(g.grid_id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] text-left transition-colors hover:bg-[#f8fafc]"
                      style={{ color: g.grid_id === selectedArea ? "#1F7A63" : "#0F2A3D", fontWeight: g.grid_id === selectedArea ? 700 : 500 }}
                    >
                      <span className="truncate max-w-[150px]">
                        {g.areaName}{areaNameCounts[g.areaName] > 1 ? ` (${g.grid_id})` : ""}
                      </span>
                      <span
                        className="ml-2 flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ color: rc.text, background: rc.bg }}
                      >
                        {g.overall_risk_level || "Low"}
                      </span>
                    </button>
                  )
                })}
                {filteredAreas.length === 0 && (
                  <p className="px-4 py-3 text-[12px] text-[#6b7a8d]">No areas found</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active risk badge */}
      {currentTaData && (
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold"
          style={{ color: riskColor.text, background: riskColor.bg, border: `1px solid ${riskColor.border}` }}
        >
          <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ backgroundColor: riskColor.text }} />
          {risk} Risk · {currentTaData.grid_cell_count} grid cells
        </div>
      )}
    </div>
    </div>
  )
}
