"use client"

import dynamic from "next/dynamic"
import { useState, useCallback } from "react"
import { useUser } from "@/lib/user-context"
import type { DistrictSummary } from "@/lib/algorithm-api"
import LocationSelector, { type SelectedLocation } from "@/components/location-selector"
import GridGraph from "@/components/grid-graph"
import { Wifi } from "lucide-react"

const DynamicMapComponent = dynamic(() => import("./dry-spell-map"), { ssr: false })

export default function DrySpellPage() {
  const { user } = useUser()
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null)
  const [liveStatus, setLiveStatus] = useState<"loading" | "live" | "error">("loading")

  const handleDistrictDataLoad = useCallback((data: DistrictSummary[]) => {
    setLiveStatus(data.length > 0 ? "live" : "error")
  }, [])

  const formatDistrict = (d?: string) => d ? d.charAt(0).toUpperCase() + d.slice(1).toLowerCase() : "Lilongwe"
  const defaultDistrict = formatDistrict(user?.district)

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
          <div className="rounded-[20px] bg-white p-6 shadow-sm border border-[#e9edf1]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#0F2A3D]">Grid Diagnostic Widget</h3>
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
                liveStatus === "live" ? "bg-[#f0fdf4] text-[#22c55e]" : "bg-[#fef2f2] text-[#dc2626]"
              }`}>
                <Wifi className="h-3 w-3" /> {liveStatus === "live" ? "Live Data" : "Offline Fallback"}
              </span>
            </div>
            <div className="space-y-3">
              {[
                ["Selected Area", selectedLocation?.areaName || selectedLocation?.ta || selectedLocation?.district || defaultDistrict],
                ["Grid ID", selectedLocation?.grid || "Select an area grid"],
                ["Dry Spell Probability", selectedLocation?.gridData?.dry_spell_probability != null ? `${(selectedLocation.gridData.dry_spell_probability * 100).toFixed(1)}%` : "-"],
                ["Risk Level", selectedLocation?.gridData?.overall_risk_level || selectedLocation?.taData?.overall_risk_level || "Pending"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[14px] border border-[#e2e8f0] bg-[#f8fafc] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">{label}</p>
                  <p className="mt-1 text-[15px] font-extrabold text-[#0F2A3D]">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-[14px] border border-[#bfdbfe] bg-[#eff6ff] p-3 text-[13px] leading-relaxed text-[#1e3a8a]">
              Dry spell detection flags seasons where post-onset daily rainfall drops below 1mm for sustained runs.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
