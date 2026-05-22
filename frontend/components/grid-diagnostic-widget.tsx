"use client"

import { AlertCircle, Wifi } from "lucide-react"
import type { DistrictSummary } from "@/lib/algorithm-api"
import type { SelectedLocation } from "@/components/location-selector"

interface GridDiagnosticWidgetProps {
  metricLabel: string
  metricValue: number | null
  selectedLocation: SelectedLocation | null
  defaultDistrict: string
  liveStatus: "loading" | "live" | "error"
  liveDistrict: DistrictSummary | null
}

function percent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "-"
}

export default function GridDiagnosticWidget({
  metricValue,
  selectedLocation,
  defaultDistrict,
  liveStatus,
  liveDistrict,
}: GridDiagnosticWidgetProps) {
  const gridData = selectedLocation?.gridData
  const selectedArea = selectedLocation?.areaName || selectedLocation?.ta || selectedLocation?.district || defaultDistrict
  const onsetProbability = gridData?.onset_probability ?? metricValue
  const falseOnsetProbability = gridData?.false_onset_probability ?? liveDistrict?.average_false_onset_probability
  const drySpellProbability = gridData?.dry_spell_probability ?? liveDistrict?.average_dry_spell_probability

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm border border-[#e9edf1]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold text-[#0F2A3D]">Grid Diagnostic Widget</h3>
        {liveStatus === "live" && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#22c55e] bg-[#f0fdf4] px-3 py-1 rounded-full border border-[#bbf7d0]">
            <Wifi className="h-3 w-3" /> Live
          </span>
        )}
      </div>
      <p className="mb-4 rounded-md border border-[#dceee8] bg-[#f3faf7] p-3 text-[12px] font-medium leading-relaxed text-[#315f52]">
        Diagnostics are tied to the selected grid cell. Area selections resolve to the grid cell containing or representing that geography.
      </p>
      <div className="space-y-3">
        {[
          ["Selected Area", selectedArea],
          ["Grid ID", selectedLocation?.grid || "Select an area grid"],
          ["Onset Probability", percent(onsetProbability)],
          ["False Onset Probability", percent(falseOnsetProbability)],
          ["Dry Spell Probability", percent(drySpellProbability)],
          ["Risk Level", gridData?.overall_risk_level || selectedLocation?.taData?.overall_risk_level || liveDistrict?.overall_risk_level || "Pending"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">{label}</p>
            <p className="mt-1 text-[15px] font-extrabold text-[#0F2A3D]">{value}</p>
          </div>
        ))}
      </div>
      {!selectedLocation?.gridData && (
        <div className="mt-4 rounded-md border border-dashed border-[#e2e8f0] bg-white p-4 flex flex-col items-center justify-center text-center gap-2">
          <AlertCircle className="h-6 w-6 text-[#6b7a8d]" />
          <p className="text-[12px] text-[#6b7a8d] font-medium">Select location under grid cell to view grid-level diagnostics</p>
        </div>
      )}
    </div>
  )
}
