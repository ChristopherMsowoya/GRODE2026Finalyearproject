"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, ChevronDown, Loader2, MapPin } from "lucide-react"
import {
  fetchEnumerationAreas,
  fetchLocationDistricts,
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
  return {
    grid_id: String(area.grid_id),
    area_name: area.ea_name,
    area_place_type: "enumeration_area",
    latitude: Number(grid.latitude ?? grid.centroid_lat ?? 0),
    longitude: Number(grid.longitude ?? grid.centroid_lon ?? 0),
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

export default function LocationSelector({ onLocationChange, defaultDistrict = "Lilongwe" }: LocationSelectorProps) {
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [areas, setAreas] = useState<EnumerationAreaOption[]>([])
  const [selectedDistrict, setSelectedDistrict] = useState(defaultDistrict)
  const [selectedAreaId, setSelectedAreaId] = useState("")
  const [districtOpen, setDistrictOpen] = useState(false)
  const [areaOpen, setAreaOpen] = useState(false)
  const [loadingDistricts, setLoadingDistricts] = useState(true)
  const [loadingAreas, setLoadingAreas] = useState(false)
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
      setMessage(response.available ? null : response.detail || "Enumeration areas are not loaded yet.")
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
      const response = await fetchEnumerationAreas(selectedDistrict, controller.signal)
      if (controller.signal.aborted) return
      setAreas(response.enumeration_areas || [])
      setEaAvailable(response.available)
      setMessage(response.available ? null : response.detail || "Enumeration areas are not loaded yet.")
      setLoadingAreas(false)
    }
    if (selectedDistrict) void loadAreas()
    return () => controller.abort()
  }, [selectedDistrict])

  const selectedArea = useMemo(
    () => areas.find((area) => area.id === selectedAreaId) || null,
    [areas, selectedAreaId]
  )

  useEffect(() => {
    const gridData = selectedArea ? toGridOption(selectedArea) : null
    onLocationChange({
      district: selectedDistrict,
      ta: selectedArea?.ta_name || null,
      taData: null,
      grid: gridData?.grid_id || null,
      gridData,
      areaName: selectedArea?.ea_name || null,
      enumerationAreaId: selectedArea?.id || null,
    })
  }, [onLocationChange, selectedArea, selectedDistrict])

  const chooseDistrict = useCallback((district: string) => {
    setSelectedDistrict(district)
    setDistrictOpen(false)
  }, [])

  const chooseArea = useCallback((areaId: string) => {
    setSelectedAreaId(areaId)
    setAreaOpen(false)
  }, [])

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
        <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-[#6b7a8d]">
          <MapPin className="h-3.5 w-3.5" />
          EA selector:
        </div>

        <div className="relative">
          <button
            onClick={() => { setDistrictOpen((value) => !value); setAreaOpen(false) }}
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
                  <span className="text-[11px] text-[#6b7a8d]">{district.enumeration_area_count} EAs</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            disabled={!eaAvailable || loadingAreas}
            onClick={() => { setAreaOpen((value) => !value); setDistrictOpen(false) }}
            className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-semibold text-[#0F2A3D] shadow-sm disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
          >
            {loadingAreas ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <span className="max-w-[220px] truncate">{selectedArea?.ea_name || "Select Enumeration Area"}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-[#6b7a8d] transition-transform ${areaOpen ? "rotate-180" : ""}`} />
              </>
            )}
          </button>
          {areaOpen && (
            <div className="absolute left-0 top-full mt-1.5 max-h-80 w-80 overflow-y-auto rounded-lg border border-[#e2e8f0] bg-white p-1.5 shadow-xl" style={{ zIndex: 2000 }}>
              {areas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => chooseArea(area.id)}
                  className="block w-full rounded-md px-3 py-2 text-left hover:bg-[#f8fafc]"
                >
                  <span className="block text-[13px] font-bold text-[#0F2A3D]">{area.ea_name}</span>
                  <span className="block text-[11px] font-semibold text-[#6b7a8d]">
                    Grid {area.grid_id || "unmapped"} / {area.intersecting_grid_count || 0} intersections
                  </span>
                </button>
              ))}
              {areas.length === 0 && (
                <p className="px-3 py-3 text-[12px] font-medium text-[#6b7a8d]">No enumeration areas available for this district.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
