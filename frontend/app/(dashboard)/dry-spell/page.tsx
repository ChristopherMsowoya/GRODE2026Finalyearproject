"use client"

import dynamic from "next/dynamic"
import { useState, useCallback } from "react"
import { useUser } from "@/lib/user-context"
import type { DistrictSummary } from "@/lib/algorithm-api"
import LocationSelector, { type SelectedLocation } from "@/components/location-selector"
import GridGraph from "@/components/grid-graph"

const DynamicMapComponent = dynamic(() => import("./dry-spell-map"), { ssr: false })

export default function DrySpellPage() {
  const { user } = useUser()
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null)
  const [liveStatus, setLiveStatus] = useState<"loading" | "live" | "error">("loading")

  const handleDistrictDataLoad = useCallback((data: DistrictSummary[]) => {
    setLiveStatus("live")
  }, [])

  const formatDistrict = (d?: string) => d ? d.charAt(0).toUpperCase() + d.slice(1).toLowerCase() : "Lilongwe"
  const defaultDistrict = formatDistrict(user?.district)

  const handleLocationChange = (loc: SelectedLocation) => {
    setSelectedLocation(loc)
  }

  return (
    <div className="space-y-6 bg-[#eef2f4] px-0 pb-6">
      <div className="rounded-[20px] bg-white p-6 md:p-8 shadow-sm border border-[#e9edf1]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-[0.32em] text-[#6b7a8d]">Dry Spell Analysis</p>
            <h1 className="text-4xl font-bold text-[#0d2f3f]">Dry Spell Risk</h1>
            <p className="max-w-2xl text-sm leading-6 text-[#6b7a8d]">
              Monitor dry spell risk patterns across Malawi based on rainfall variability and prolonged dry periods.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-full bg-[#fef3e0] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.24em]" style={{ color: "#d97706" }}>
              Active Monitoring
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
          <LocationSelector
            onLocationChange={handleLocationChange}
            defaultDistrict={defaultDistrict}
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-5">
          <div className="rounded-[20px] bg-white p-0 shadow-sm border border-[#e9edf1] overflow-hidden" style={{ minHeight: "600px" }}>
            <DynamicMapComponent
              selectedLocation={selectedLocation}
              onLocationChange={handleLocationChange}
              userDistrict={user?.district || ""}
              onDistrictDataLoad={handleDistrictDataLoad}
            />
          </div>

          {selectedLocation && selectedLocation.grid && (
            <GridGraph location={selectedLocation} metricType="dry_spell" />
          )}
        </div>

        <div className="flex flex-col gap-5">
          {/* Right panel handled by the imported component's live stats */}
        </div>
      </div>
    </div>
  )
}
