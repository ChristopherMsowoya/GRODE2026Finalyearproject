"use client"

import { Info, Wifi } from "lucide-react"
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

function riskLevelForMetric(metricLabel: string, metricValue: number | null | undefined, hasGrid: boolean) {
  if (!hasGrid) return "Select an area grid"
  if (typeof metricValue !== "number" || !Number.isFinite(metricValue)) return "-"

  const pct = metricValue * 100

  if (metricLabel === "Onset Probability") {
    if (pct > 60) return "Low"
    if (pct > 30) return "Medium"
    return "High"
  }

  if (pct > 60) return "High"
  if (pct > 30) return "Medium"
  return "Low"
}

function riskTooltip(metricLabel: string) {
  if (metricLabel === "Onset Probability") {
    return "Page-specific grid risk derived from onset probability only. High onset probability means lower onset risk for the selected grid cell."
  }
  return `Page-specific grid risk derived from ${metricLabel.toLowerCase()} only for the selected grid cell.`
}

export default function GridDiagnosticWidget({
  metricLabel,
  metricValue,
  selectedLocation,
  defaultDistrict,
  liveStatus,
  liveDistrict,
}: GridDiagnosticWidgetProps) {
  const gridData = selectedLocation?.gridData
  const selectedArea = selectedLocation?.areaName || selectedLocation?.ta || selectedLocation?.district || defaultDistrict
  const riskLevel = riskLevelForMetric(metricLabel, metricValue, Boolean(gridData))
  const drySpellStressRows = metricLabel === "Dry Spell Probability" ? [
    {
      label: "5-Day Stress",
      value: gridData ? percent(gridData.dry_spell_probability_5day ?? gridData.dry_spell_probability) : "Select an area grid",
      tooltip: "Probability that the selected grid has a 5+ consecutive dry-day spell within 20 days after valid onset.",
    },
    {
      label: "7-Day Stress",
      value: gridData ? percent(gridData.dry_spell_probability_7day) : "Select an area grid",
      tooltip: "Probability that the selected grid has a 7+ consecutive dry-day spell within 20 days after valid onset.",
    },
    {
      label: "9-Day Stress",
      value: gridData ? percent(gridData.dry_spell_probability_9day) : "Select an area grid",
      tooltip: "Probability that the selected grid has a 9+ consecutive dry-day spell within 20 days after valid onset.",
    },
  ] : []
  const rows = [
    {
      label: "Selected Area",
      value: selectedArea,
      tooltip: "The searched geography selected by the user. It is linked to the nearest rainfall grid cell.",
    },
    {
      label: "Grid ID",
      value: selectedLocation?.grid || "Select an area grid",
      tooltip: "The rainfall grid cell used to retrieve diagnostics for the selected area.",
    },
    ...(metricLabel === "Onset Probability" ? [] : [{
      label: metricLabel,
      value: gridData ? percent(metricValue) : "Select an area grid",
      tooltip: `${metricLabel} for the selected grid cell only, calculated from the seasons available for that grid.`,
    }]),
    ...drySpellStressRows,
    {
      label: "Risk Level",
      value: riskLevel,
      tooltip: riskTooltip(metricLabel),
    },
  ]

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm border border-[#e9edf1] sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
        {rows.map(({ label, value, tooltip }) => (
          <div key={label} className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">{label}</p>
              <span className="group relative inline-flex">
                <Info className="h-3.5 w-3.5 cursor-help text-[#6b7a8d]" />
                <span className="pointer-events-none absolute left-1/2 top-5 z-[2000] hidden w-56 -translate-x-1/2 rounded-md border border-[#d6dee8] bg-white p-2.5 text-[11px] font-medium leading-relaxed text-[#0F2A3D] shadow-lg group-hover:block">
                  {tooltip}
                </span>
              </span>
            </div>
            <p className="mt-1 break-words text-[14px] font-extrabold text-[#0F2A3D] sm:text-[15px]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
