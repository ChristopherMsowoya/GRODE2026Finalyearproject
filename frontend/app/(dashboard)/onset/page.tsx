"use client"

import { useCallback, useEffect, useState } from "react"
import { useUser } from "@/lib/user-context"
import { Wifi } from "lucide-react"
import type { DistrictSummary } from "@/lib/algorithm-api"
import LocationSelector, { type SelectedLocation } from "@/components/location-selector"
import GridGraph from "@/components/grid-graph"
import GridDiagnosticWidget from "@/components/grid-diagnostic-widget"
import SeasonalOnsetTimeline from "@/components/seasonal-onset-timeline"
import dynamic from "next/dynamic"

const OnsetMap = dynamic(() => import("./onset-map"), { ssr: false })

export default function OnsetInfoPage() {
  const { user } = useUser()
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null)
  const [liveDistrictData, setLiveDistrictData] = useState<DistrictSummary[]>([])
  const [liveStatus, setLiveStatus] = useState<"loading" | "live" | "error">("loading")

  const formatDistrict = (district?: string) => district ? district.charAt(0).toUpperCase() + district.slice(1).toLowerCase() : "Lilongwe"
  const defaultDistrict = formatDistrict(user?.district)
  const activeDistrict = selectedLocation?.district || defaultDistrict
  const liveSelectedDistrict = liveDistrictData.find((district) => district.district === activeDistrict) || null

  useEffect(() => {
    let cancelled = false
    async function loadLiveData() {
      try {
        const { fetchDistrictSummary } = await import("@/lib/algorithm-api")
        const response = await fetchDistrictSummary()
        if (cancelled) return
        setLiveDistrictData(response.districts)
        setLiveStatus(response.districts.length > 0 ? "live" : "error")
      } catch {
        if (!cancelled) setLiveStatus("error")
      }
    }
    void loadLiveData()
    return () => { cancelled = true }
  }, [])

  const handleLocationChange = useCallback((loc: SelectedLocation) => {
    setSelectedLocation((prev) => {
      if (prev?.district === loc.district && prev?.ta === loc.ta && prev?.grid === loc.grid && prev?.areaName === loc.areaName) return prev
      return loc
    })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[36px] font-extrabold tracking-tight leading-tight text-[#0F2A3D]">
              Rainfall Onset Detection
            </h1>
            {liveStatus === "live" && liveSelectedDistrict && (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#22c55e] bg-[#f0fdf4] border border-[#bbf7d0] px-3 py-1 rounded-full">
                <Wifi className="h-3 w-3" /> Live Data
              </span>
            )}
          </div>
          <p className="text-[14px] text-[#6b7a8d] mt-1">
            for {selectedLocation?.areaName || selectedLocation?.ta || activeDistrict}
          </p>
        </div>
      </div>

      <div className="rounded-2xl p-4 border border-[#e2e8f0] bg-white">
        <LocationSelector onLocationChange={handleLocationChange} defaultDistrict={defaultDistrict} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-5">
          <div className="rounded-[20px] bg-white p-0 shadow-sm border border-[#e9edf1] overflow-hidden" style={{ minHeight: "500px" }}>
            <OnsetMap
              selectedLocation={selectedLocation}
              onLocationChange={handleLocationChange}
              userDistrict={user?.district || null}
              onDistrictDataLoad={() => {}}
            />
          </div>
          <SeasonalOnsetTimeline location={selectedLocation} />
          <GridGraph location={selectedLocation} metricType="onset" />
        </div>

        <div className="flex flex-col gap-5">
          <GridDiagnosticWidget
            metricLabel="Onset Probability"
            metricValue={
              selectedLocation?.gridData?.onset_probability ??
              (liveSelectedDistrict?.onset_detection_rate ?? null)
            }
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
