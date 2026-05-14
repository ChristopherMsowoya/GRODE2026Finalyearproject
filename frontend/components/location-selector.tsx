"use client"

import { useState, useEffect, useCallback } from "react"
import { MapPin, ChevronDown, Search, Loader2, AlertCircle } from "lucide-react"
import malawiAdminData from "@/lib/data/malawiAdministrativeData.json"

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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000"

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
  
  const [gridsLoading, setGridsLoading] = useState(false)
  const [taGrids, setTaGrids] = useState<GridOption[]>([])

  // Load hierarchy on mount
  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/locations/hierarchy`)
        if (!res.ok) throw new Error("Failed to load location data")
        const data = await res.json()
        setHierarchy(data.districts || [])
      } catch (e) {
        setError("Could not load location data")
      } finally {
        setLoading(false)
      }
    }
    fetchHierarchy()
  }, [])

  // Load grids when TA is selected
  useEffect(() => {
    if (!selectedTA) {
      setTaGrids([])
      setSelectedArea("")
      return
    }
    const fetchGrids = async () => {
      setGridsLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/locations/ta-grids?district=${encodeURIComponent(selectedDistrict)}&ta=${encodeURIComponent(selectedTA)}`)
        if (res.ok) {
          const data = await res.json()
          setTaGrids(data.grids || [])
        } else {
          setTaGrids([])
        }
      } catch (e) {
        setTaGrids([])
      } finally {
        setGridsLoading(false)
      }
    }
    fetchGrids()
  }, [selectedTA, selectedDistrict])

  const currentDistrict = hierarchy.find(d => d.district === selectedDistrict)
  const currentTas = currentDistrict?.traditional_authorities || []
  const currentTaData = currentTas.find(t => t.ta === selectedTA) || null

  // Map area names from json
  const currentDistrictAdmin = malawiAdminData.districts.find(d => d.name.toLowerCase() === selectedDistrict.toLowerCase())
  const currentTaAdmin = currentDistrictAdmin?.traditionalAuthorities.find(t => t.name.toLowerCase().includes(selectedTA.toLowerCase()))
  const adminAreas = currentTaAdmin?.areas || []

  // Combine grids with area names
  const gridAreaOptions = taGrids.map((grid, index) => {
    const areaName = adminAreas[index] ? adminAreas[index].name : `Local Area ${index + 1}`
    return {
      ...grid,
      areaName
    }
  })

  const filteredDistricts = hierarchy.filter(d =>
    d.district.toLowerCase().includes(districtSearch.toLowerCase())
  )
  const filteredTas = currentTas.filter(t =>
    t.ta.toLowerCase().includes(taSearch.toLowerCase())
  )
  const filteredAreas = gridAreaOptions.filter(g => 
    g.areaName.toLowerCase().includes(areaSearch.toLowerCase()) || g.grid_id.toLowerCase().includes(areaSearch.toLowerCase())
  )

  const currentGridData = gridAreaOptions.find(g => g.areaName === selectedArea) || null

  // Notify parent when selection changes
  useEffect(() => {
    onLocationChange({
      district: selectedDistrict,
      ta: selectedTA || null,
      taData: currentTaData,
      grid: currentGridData ? currentGridData.grid_id : null,
      gridData: currentGridData ? currentGridData : null,
      areaName: selectedArea || null,
    })
  }, [selectedDistrict, selectedTA, currentTaData, selectedArea, currentGridData])

  const handleDistrictSelect = (district: string) => {
    setSelectedDistrict(district)
    setSelectedTA("")
    setSelectedArea("")
    setDistrictOpen(false)
    setDistrictSearch("")
  }

  const handleTaSelect = (ta: string) => {
    setSelectedTA(ta)
    setSelectedArea("")
    setTaOpen(false)
    setTaSearch("")
  }

  const handleAreaSelect = (areaName: string) => {
    setSelectedArea(areaName)
    setAreaOpen(false)
    setAreaSearch("")
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] text-[#6b7a8d]"
        style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading locations...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] text-[#D64545]"
        style={{ background: "rgba(214,69,69,0.06)", border: "1px solid rgba(214,69,69,0.2)" }}>
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    )
  }

  const risk = currentTaData?.overall_risk_level || (currentDistrict ? "Low" : "Low")
  const riskColor = RISK_COLORS[risk]

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Location pin label */}
      <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-[#6b7a8d]">
        <MapPin className="h-3.5 w-3.5" />
        Location
      </div>

      {/* District Dropdown */}
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
              {filteredTas.map(t => {
                const rc = RISK_COLORS[t.overall_risk_level]
                return (
                  <button
                    key={t.ta}
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
                  {selectedArea ? `${selectedArea}` : "Select Area"}
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
                      onClick={() => handleAreaSelect(g.areaName)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] text-left transition-colors hover:bg-[#f8fafc]"
                      style={{ color: g.areaName === selectedArea ? "#1F7A63" : "#0F2A3D", fontWeight: g.areaName === selectedArea ? 700 : 500 }}
                    >
                      <span className="truncate max-w-[150px]">{g.areaName}</span>
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
  )
}
