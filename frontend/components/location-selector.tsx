"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, ChevronDown, Loader2, Search } from "lucide-react"
import {
  fetchLocationDistricts,
  searchAreasInDistrict,
  type EnumerationAreaOption,
} from "@/lib/algorithm-api"

export interface TaOption {
  ta: string
  grid_cell_count: number
  overall_risk_level: "Low" | "Medium" | "High"
  average_false_onset_probability: number
  average_dry_spell_probability: number
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
  enumerationAreaId?: string | null
}

interface DistrictOption {
  district: string
  enumeration_area_count: number
}

interface LocationSelectorProps {
  onLocationChange: (location: SelectedLocation) => void
  defaultDistrict?: string
}

function toGridOption(area: EnumerationAreaOption): GridOption | null {
  const grid = area.grid as Record<string, any> | null | undefined
  if (!grid || !area.grid_id) return null
  const seasons = Number(grid.seasons_analyzed ?? 0)
  const gridLatitude = Number(grid.latitude ?? grid.centroid_lat ?? 0)
  const gridLongitude = Number(grid.longitude ?? grid.centroid_lon ?? 0)
  const areaLatitude = Number(area.area_latitude ?? gridLatitude)
  const areaLongitude = Number(area.area_longitude ?? gridLongitude)
  return {
    grid_id: String(area.grid_id),
    area_name: displayAreaName(area),
    area_place_type: "enumeration_area",
    area_latitude: areaLatitude,
    area_longitude: areaLongitude,
    latitude: areaLatitude,
    longitude: areaLongitude,
    overall_risk_level: grid.overall_risk_level ?? "Low",
    false_onset_probability: Number(grid.false_onset_probability ?? 0),
    dry_spell_probability: Number(grid.dry_spell_probability ?? 0),
    onset_probability: Number(grid.onset_probability ?? (
      grid.seasons_with_detected_onset && seasons ? grid.seasons_with_detected_onset / seasons : 0
    )),
    seasons_analyzed: seasons,
    seasons_with_detected_onset: Number(grid.seasons_with_detected_onset ?? 0),
    first_detected_onset_date: grid.first_detected_onset_date ?? null,
    latest_detected_onset_date: grid.latest_detected_onset_date ?? null,
    false_onset_interpretation: grid.false_onset_interpretation ?? "",
    dry_spell_interpretation: grid.dry_spell_interpretation ?? "",
  }
}

function displayAreaName(area: EnumerationAreaOption) {
  return area.display_name?.trim() || area.ta_name?.trim() || area.ea_name?.trim() || `${area.district_name} area`
}

export default function LocationSelector({ onLocationChange, defaultDistrict = "Lilongwe" }: LocationSelectorProps) {
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [areas, setAreas] = useState<EnumerationAreaOption[]>([])
  const [selectedDistrict, setSelectedDistrict] = useState(defaultDistrict)
  const [selectedAreaId, setSelectedAreaId] = useState("")
  const [areaQuery, setAreaQuery] = useState("")
  const [districtOpen, setDistrictOpen] = useState(false)
  const [areaFocused, setAreaFocused] = useState(false)
  const [loadingDistricts, setLoadingDistricts] = useState(true)
  const [loadingAreas, setLoadingAreas] = useState(false)
  const [searchingAreas, setSearchingAreas] = useState(false)
  const [eaAvailable, setEaAvailable] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function loadDistricts() {
      setLoadingDistricts(true)
      const response = await fetchLocationDistricts(controller.signal)
      if (controller.signal.aborted) return
      setDistricts(response.districts || [])
      setEaAvailable(response.available)
      setMessage(response.available ? null : response.detail || "Location areas are not loaded yet.")
      if (!response.districts.some((row) => row.district === selectedDistrict) && response.districts[0]) {
        setSelectedDistrict(response.districts[0].district)
      }
      setLoadingDistricts(false)
    }
    void loadDistricts()
    return () => controller.abort()
  }, [selectedDistrict])

  useEffect(() => {
    const controller = new AbortController()
    async function loadAreas() {
      setLoadingAreas(true)
      setSelectedAreaId("")
      setAreaQuery("")
      if (controller.signal.aborted) return
      setAreas([])
      setEaAvailable(true)
      setMessage(null)
      setLoadingAreas(false)
    }
    if (selectedDistrict) void loadAreas()
    return () => controller.abort()
  }, [selectedDistrict])

  const selectedArea = useMemo(
    () => areas.find((area) => area.id === selectedAreaId) || null,
    [areas, selectedAreaId]
  )

  const visibleAreas = useMemo(() => areas.slice(0, 12), [areas])

  useEffect(() => {
    const query = areaQuery.trim()
    if (query.length < 2 || !selectedDistrict) return

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setSearchingAreas(true)
      try {
        const response = await searchAreasInDistrict(selectedDistrict, query, controller.signal)
        if (controller.signal.aborted) return
        const nextAreas = response.enumeration_areas || []
        setAreas(nextAreas)
        setSelectedAreaId(nextAreas[0]?.id || "")
      } finally {
        if (!controller.signal.aborted) setSearchingAreas(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [areaQuery, selectedDistrict])

  useEffect(() => {
    const gridData = selectedArea ? toGridOption(selectedArea) : null
    onLocationChange({
      district: selectedDistrict,
      ta: selectedArea?.ta_name || null,
      taData: null,
      grid: gridData?.grid_id || null,
      gridData,
      areaName: selectedArea ? displayAreaName(selectedArea) : null,
      enumerationAreaId: selectedArea?.id || null,
    })
  }, [onLocationChange, selectedArea, selectedDistrict])

  useEffect(() => {
    const query = areaQuery.trim()
    if (query.length < 2) {
      setSelectedAreaId("")
      return
    }

    const firstMatch = visibleAreas[0]
    if (firstMatch && firstMatch.id !== selectedAreaId) {
      setSelectedAreaId(firstMatch.id)
    }
  }, [areaQuery, visibleAreas, selectedAreaId])

  const chooseDistrict = useCallback((district: string) => {
    setSelectedDistrict(district)
    setAreaQuery("")
    setDistrictOpen(false)
  }, [])

  const chooseArea = useCallback((areaId: string) => {
    const area = areas.find((item) => item.id === areaId)
    setSelectedAreaId(areaId)
    setAreaQuery(area ? displayAreaName(area) : "")
    setAreaFocused(false)
  }, [areas])

  const chooseFirstVisibleArea = useCallback(() => {
    const firstArea = visibleAreas[0]
    if (firstArea) chooseArea(firstArea.id)
  }, [chooseArea, visibleAreas])

  if (loadingDistricts) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-[13px] font-medium text-[#6b7a8d]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading location hierarchy...
      </div>
    )
  }

  return (
    <div className="relative z-[1400] flex flex-col gap-2">
      {message && (
        <div className="flex w-fit items-center gap-1.5 rounded-lg border border-[#fde68a] bg-[#fef3c7] px-3 py-1.5 text-[11px] font-semibold text-[#92400e]">
          <AlertCircle className="h-3.5 w-3.5" />
          {message}
        </div>
      )}

      <div className="relative z-[1400] flex flex-wrap items-center gap-3">
        <div className="relative">
          <button
            onClick={() => { setDistrictOpen((value) => !value); setAreaFocused(false) }}
            className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-semibold text-[#0F2A3D] shadow-sm"
          >
            <span className="max-w-[170px] truncate">{selectedDistrict} District</span>
            <ChevronDown className={`h-3.5 w-3.5 text-[#6b7a8d] transition-transform ${districtOpen ? "rotate-180" : ""}`} />
          </button>
          {districtOpen && (
            <div className="absolute left-0 top-full mt-1.5 max-h-72 w-64 overflow-y-auto rounded-lg border border-[#e2e8f0] bg-white p-1.5 shadow-xl" style={{ zIndex: 2000 }}>
              {districts.map((district) => (
                <button
                  key={district.district}
                  onClick={() => chooseDistrict(district.district)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[13px] font-semibold hover:bg-[#f8fafc]"
                  style={{ color: district.district === selectedDistrict ? "#1F7A63" : "#0F2A3D" }}
                >
                  <span>{district.district}</span>
                  <span className="text-[11px] text-[#6b7a8d]">{district.enumeration_area_count} areas</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative w-[340px] max-w-full">
          <div className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] font-semibold text-[#0F2A3D] shadow-sm">
            {loadingAreas ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : searchingAreas ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1F7A63]" />
            ) : (
              <Search className="h-3.5 w-3.5 text-[#6b7a8d]" />
            )}
            <input
              disabled={!eaAvailable || loadingAreas}
              value={areaQuery}
              onFocus={() => { setAreaFocused(true); setDistrictOpen(false) }}
              onChange={(event) => setAreaQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  chooseFirstVisibleArea()
                }
              }}
              placeholder={`Search area in ${selectedDistrict}`}
              className="w-full bg-transparent text-[13px] font-semibold text-[#0F2A3D] outline-none placeholder:text-[#94a3b8] disabled:cursor-not-allowed disabled:text-[#94a3b8]"
            />
          </div>
          {areaFocused && areaQuery.trim().length >= 2 && (
            <div className="absolute left-0 top-full mt-1.5 max-h-80 w-80 overflow-y-auto rounded-lg border border-[#e2e8f0] bg-white p-1.5 shadow-xl" style={{ zIndex: 2000 }}>
              {visibleAreas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => chooseArea(area.id)}
                  onMouseDown={(event) => event.preventDefault()}
                  className="block w-full rounded-md px-3 py-2 text-left hover:bg-[#f8fafc]"
                >
                  <span className="block text-[13px] font-bold text-[#0F2A3D]">{displayAreaName(area)}</span>
                  <span className="block text-[11px] font-semibold text-[#6b7a8d]">
                    {area.district_name} / {area.place_type || "area"} / Grid {area.grid_id || "unmapped"}
                  </span>
                </button>
              ))}
              {areas.length === 0 && (
                <p className="px-3 py-3 text-[12px] font-medium text-[#6b7a8d]">
                  {searchingAreas ? "Searching areas..." : `No matching area found in ${selectedDistrict}.`}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
