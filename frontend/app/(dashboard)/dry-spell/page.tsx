"use client"

import dynamic from "next/dynamic"
import { useState, useCallback } from "react"
import { useUser } from "@/lib/user-context"
import type { DistrictSummary } from "@/lib/algorithm-api"
import LocationSelector, { type SelectedLocation } from "@/components/location-selector"
import GridGraph from "@/components/grid-graph"
import GridDiagnosticWidget from "@/components/grid-diagnostic-widget"
import { Wifi } from "lucide-react"

const DynamicMapComponent = dynamic(() => import("./dry-spell-map"), { ssr: false })

export default function DrySpellPage() {
  const { user } = useUser()
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null)
  const [liveStatus, setLiveStatus] = useState<"loading" | "live" | "error">("loading")
  const [liveDistrictData, setLiveDistrictData] = useState<DistrictSummary[]>([])

  const handleDistrictDataLoad = useCallback((data: DistrictSummary[]) => {
    setLiveDistrictData(data)
    setLiveStatus(data.length > 0 ? "live" : "error")
  }, [])

  const formatDistrict = (d?: string) => d ? d.charAt(0).toUpperCase() + d.slice(1).toLowerCase() : "Lilongwe"
  const defaultDistrict = formatDistrict(user?.district)
  const activeDistrict = selectedLocation?.district || defaultDistrict
  const liveSelectedDistrict = liveDistrictData.find(d => d.district === activeDistrict) || null

  const handleLocationChange = useCallback((loc: SelectedLocation) => {
    setSelectedLocation((prev) => {
      if (
        prev?.district === loc.district &&
        prev?.ta === loc.ta &&
        prev?.grid === loc.grid &&
        prev?.areaName === loc.areaName
      ) {
        return prev
      }
      return loc
    })
  }, [])

  return (
    <div className="space-y-6 bg-[#eef2f4] px-0 pb-6">
      {/* ── Page header ───────────────────────────────────────────── */}
      <div className="rounded-[20px] bg-white p-6 md:p-8 shadow-sm border border-[#e9edf1]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-[12px] uppercase tracking-[0.32em] text-[#6b7a8d]">Dry Spell Analysis</p>
            <h1 className="text-4xl font-bold text-[#0d2f3f]">Dry Spell Risk</h1>
          </div>
          {liveStatus === "live" && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#22c55e] bg-[#f0fdf4] border border-[#bbf7d0] px-3 py-1.5 rounded-full w-fit">
              <Wifi className="h-3 w-3" /> Live Data
            </span>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
          <LocationSelector
            onLocationChange={handleLocationChange}
            defaultDistrict={defaultDistrict}
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        {/* Left Panel: Map + Graph */}
        <div className="flex flex-col gap-5">
          <div className="rounded-[20px] bg-white p-0 shadow-sm border border-[#e9edf1] overflow-hidden" style={{ minHeight: "600px" }}>
            <DynamicMapComponent
              selectedLocation={selectedLocation}
              onLocationChange={handleLocationChange}
              userDistrict={user?.district || ""}
              onDistrictDataLoad={handleDistrictDataLoad}
            />
          </div>

          {/* ── Grid Graph Visualization ────────────────────────────────────── */}
          <GridGraph
            location={selectedLocation}
            metricType="dry_spell"
          />
        </div>

        {/* Right Panel: Stats */}
        <div className="flex flex-col gap-5">
          <GridDiagnosticWidget
            metricLabel="Dry Spell Probability"
            metricValue={selectedLocation?.gridData?.dry_spell_probability ?? null}
            selectedLocation={selectedLocation}
            defaultDistrict={defaultDistrict}
            liveStatus={liveStatus}
            liveDistrict={liveSelectedDistrict}
          />
        </div>
      </div>
    </div>
  )
}
