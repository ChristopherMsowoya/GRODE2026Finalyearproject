"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Info } from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { fetchOnsetTimeline, fetchSeasonYears, type OnsetTimelineResponse, type SeasonRangeOption } from "@/lib/algorithm-api"
import type { SelectedLocation } from "./location-selector"

const DEFAULT_RANGES: SeasonRangeOption[] = [
  { label: "All Seasons", value: "all", start_year: null, end_year: null },
]

type ChartPoint = {
  label: string
  dateLabel: string
  seasonYear: number | null
  probability: number
  onsetDate: string
}

const TOOLTIP_TEXT = {
  timeline: "True onset trigger dates detected by the rainfall onset algorithm for the selected grid cell. Each point is an observed trigger event, not an average.",
  p10: "P10 is the early-onset threshold: 10% of valid onset triggers occurred on or before this rainy-season date.",
  median: "Median onset is the central trigger date: half of valid onset triggers occurred before it and half after it.",
  p90: "P90 is the late-onset threshold: 90% of valid onset triggers occurred on or before this rainy-season date.",
}

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
    return () => {
      cancelled = true
    }
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
    return () => {
      cancelled = true
    }
  }, [gridId, selectedRange.end, selectedRange.start])

  const chartData = useMemo<ChartPoint[]>(() => {
    return (timeline?.series || [])
      .filter((point) => isRainySeasonDate(point.onset_date))
      .map((point) => ({
        label: rainySeasonLabel(point.onset_date, point.season_year),
        dateLabel: formatDayOnly(point.onset_date),
        seasonYear: point.season_year,
        probability: Math.round((point.onset_probability || 0) * 1000) / 10,
        onsetDate: point.onset_date,
      }))
  }, [timeline])

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#f0f4f8] px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-bold text-[#0F2A3D]">Seasonal Timeline</h3>
            <ScientificTooltip text={TOOLTIP_TEXT.timeline} />
          </div>
          <p className="mt-0.5 text-[12px] font-semibold text-[#6b7a8d]">
            {gridId ? `Grid ${gridId} true onset trigger events, November-April` : "Select a grid cell to view true onset trigger events"}
          </p>
        </div>
        <div className="relative z-[1300] flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="rounded-md border border-[#e2e8f0] bg-white px-2 py-1.5 text-[12px] font-semibold text-[#0F2A3D] outline-none focus:border-[#0F2A3D]"
          >
            {ranges.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input value={customStart} onChange={(event) => setCustomStart(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Start" className="w-16 rounded-md border border-[#e2e8f0] px-2 py-1.5 text-[12px] font-semibold outline-none focus:border-[#0F2A3D]" />
          <input value={customEnd} onChange={(event) => setCustomEnd(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="End" className="w-16 rounded-md border border-[#e2e8f0] px-2 py-1.5 text-[12px] font-semibold outline-none focus:border-[#0F2A3D]" />
        </div>
      </div>

      <div className="grid gap-3 p-6 md:grid-cols-3">
        <SummaryTile label="P10" value={timeline?.p10_onset_date} tooltip={TOOLTIP_TEXT.p10} loading={loading} />
        <SummaryTile label="Median Onset" value={timeline?.median_onset_date} tooltip={TOOLTIP_TEXT.median} loading={loading} />
        <SummaryTile label="P90" value={timeline?.p90_onset_date} tooltip={TOOLTIP_TEXT.p90} loading={loading} />
      </div>

      <div className="border-t border-[#f0f4f8] px-6 py-5">
        {loading ? (
          <div className="flex h-[280px] items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#1F7A63] border-t-transparent" />
          </div>
        ) : chartData.length ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 12 }}>
                <CartesianGrid stroke="#edf2f7" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  interval={0}
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 700 }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "Onset probability", angle: -90, position: "insideLeft", offset: 12, style: { fontSize: 11, fill: "#64748b", fontWeight: 700 } }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "Onset probability"]}
                  labelFormatter={(_, payload) => {
                    const point = payload?.[0]?.payload as ChartPoint | undefined
                    return point ? `${point.dateLabel}${point.seasonYear ? `, ${point.seasonYear}` : ""}` : "Onset trigger"
                  }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  labelStyle={{ color: "#0F2A3D", fontWeight: 800 }}
                />
                <Line
                  type="linear"
                  dataKey="probability"
                  stroke="#1F7A63"
                  strokeWidth={2.5}
                  dot={{ r: 4.5, fill: "#1F7A63", stroke: "#ffffff", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#0F2A3D", stroke: "#ffffff", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-[#d6dee8] bg-[#f8fafc] px-4 text-center">
            <p className="max-w-md text-[13px] font-medium text-[#6b7a8d]">
              No true onset trigger events are available for this selected grid cell and season range.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function SummaryTile({ label, value, tooltip, loading }: { label: string; value?: string | null; tooltip: string; loading: boolean }) {
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[#1F7A63]">
          <CalendarDays className="h-4 w-4" />
        </div>
        <ScientificTooltip text={tooltip} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">{label}</p>
      <p className="mt-1 text-[20px] font-extrabold text-[#0F2A3D]">{loading ? "..." : formatDate(value)}</p>
    </div>
  )
}

function ScientificTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <Info className="h-4 w-4 cursor-help text-[#6b7a8d]" />
      <span className="pointer-events-none absolute left-1/2 top-6 z-[2000] hidden w-64 -translate-x-1/2 rounded-md border border-[#d6dee8] bg-white p-3 text-[12px] font-medium leading-relaxed text-[#0F2A3D] shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  )
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value.replace(" ", "T"))
  return Number.isNaN(date.getTime()) ? null : date
}

function isRainySeasonDate(value?: string | null) {
  const date = parseDate(value)
  if (!date) return false
  const month = date.getMonth() + 1
  return month >= 11 || month <= 4
}

function rainySeasonLabel(value: string, seasonYear: number | null) {
  const day = formatDayOnly(value)
  return seasonYear ? `${day} '${String(seasonYear).slice(-2)}` : day
}

function formatDayOnly(value?: string | null) {
  const date = parseDate(value)
  if (!date) return "-"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function formatDate(value?: string | null) {
  const date = parseDate(value)
  if (!date) return "-"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}
