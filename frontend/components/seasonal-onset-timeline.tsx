"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays } from "lucide-react"
import { fetchOnsetTimeline, fetchSeasonYears, type OnsetTimelineResponse, type SeasonRangeOption } from "@/lib/algorithm-api"
import type { SelectedLocation } from "./location-selector"

const DEFAULT_RANGES: SeasonRangeOption[] = [
  { label: "All Seasons", value: "all", start_year: null, end_year: null },
]

export default function SeasonalOnsetTimeline({ location }: { location: SelectedLocation | null }) {
  const gridId = location?.grid
  const [ranges, setRanges] = useState<SeasonRangeOption[]>(DEFAULT_RANGES)
  const [range, setRange] = useState("all")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [timeline, setTimeline] = useState<OnsetTimelineResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchSeasonYears().then((response) => {
      if (!cancelled) setRanges(response.ranges.length ? response.ranges : DEFAULT_RANGES)
    })
    return () => { cancelled = true }
  }, [])

  const selectedRange = useMemo(() => {
    if (customStart.length === 4 || customEnd.length === 4) {
      return {
        start: customStart.length === 4 ? Number(customStart) : null,
        end: customEnd.length === 4 ? Number(customEnd) : null,
      }
    }
    const option = ranges.find((item) => item.value === range)
    return { start: option?.start_year ?? null, end: option?.end_year ?? null }
  }, [customEnd, customStart, range, ranges])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!gridId) {
        setTimeline(null)
        return
      }
      setLoading(true)
      try {
        const response = await fetchOnsetTimeline(gridId, selectedRange.start, selectedRange.end)
        if (!cancelled) setTimeline(response)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [gridId, selectedRange.end, selectedRange.start])

  return (
    <section className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#f0f4f8] px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-[16px] font-bold text-[#0F2A3D]">Seasonal Timeline</h3>
          <p className="mt-0.5 text-[12px] font-semibold text-[#6b7a8d]">
            {gridId ? `Grid ${gridId} true-onset trigger dates` : "Select a grid cell to view true-onset trigger dates"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="rounded-lg border border-[#e2e8f0] bg-white px-2 py-1.5 text-[12px] font-semibold text-[#0F2A3D] outline-none focus:border-[#0F2A3D]"
          >
            {ranges.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input value={customStart} onChange={(event) => setCustomStart(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Start" className="w-16 rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-[12px] font-semibold outline-none focus:border-[#0F2A3D]" />
          <input value={customEnd} onChange={(event) => setCustomEnd(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="End" className="w-16 rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-[12px] font-semibold outline-none focus:border-[#0F2A3D]" />
        </div>
      </div>

      <div className="grid gap-3 p-6 md:grid-cols-3">
        {[
          ["P10 Onset Date", timeline?.p10_onset_date],
          ["Median Onset Date", timeline?.median_onset_date],
          ["P90 Onset Date", timeline?.p90_onset_date],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#1F7A63]">
              <CalendarDays className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">{label}</p>
            <p className="mt-1 text-[20px] font-extrabold text-[#0F2A3D]">{loading ? "..." : formatDate(value)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}
