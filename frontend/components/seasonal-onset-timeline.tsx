"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Info, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { fetchOnsetTimeline, fetchOnsetTriggerEvents, fetchSeasonYears, type OnsetTimelineResponse, type OnsetTriggerEvent } from "@/lib/algorithm-api"
import type { SelectedLocation } from "./location-selector"

type ChartRow = {
  dayOffset: number
  [key: string]: string | number | null
}

const MONTH_TICKS = [
  { value: 0, label: "Nov" },
  { value: 30, label: "Dec" },
  { value: 61, label: "Jan" },
  { value: 92, label: "Feb" },
  { value: 120, label: "Mar" },
  { value: 151, label: "Apr" },
]

const TOOLTIP_TEXT = {
  timeline: "True onset trigger dates detected by the rainfall onset algorithm for the selected grid cell. Each point is an observed trigger event, not an average.",
  p10: "P10 is the early-onset threshold: 10% of valid onset triggers occurred on or before this rainy-season date.",
  median: "Median onset is the central trigger date: half of valid onset triggers occurred before it and half after it.",
  p90: "P90 is the late-onset threshold: 90% of valid onset triggers occurred on or before this rainy-season date.",
}

export default function SeasonalOnsetTimeline({ location }: { location: SelectedLocation | null }) {
  const gridId = location?.grid
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [timeline, setTimeline] = useState<OnsetTimelineResponse | null>(null)
  const [triggerEvents, setTriggerEvents] = useState<OnsetTriggerEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [chartZoom, setChartZoom] = useState(1)

  useEffect(() => {
    let cancelled = false
    fetchSeasonYears().then((response) => {
      if (!cancelled) {
        setAvailableYears(response.available_years || [])
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedRange = useMemo(() => {
    const start = customStart.length === 4 ? Number(customStart) : null
    const end = customEnd.length === 4 ? Number(customEnd) : null
    if (start !== null && end === null) return { start, end: start }
    if (start === null && end !== null) return { start: end, end }
    if (customStart.length === 4 || customEnd.length === 4) {
      return { start, end }
    }
    return { start: null, end: null }
  }, [customEnd, customStart])

  const hasSelectedRange = selectedRange.start !== null || selectedRange.end !== null

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!gridId || !hasSelectedRange) {
        setTimeline(null)
        setTriggerEvents([])
        return
      }
      setLoading(true)
      try {
        const [timelineResponse, triggerResponse] = await Promise.all([
          fetchOnsetTimeline(gridId, selectedRange.start, selectedRange.end),
          fetchOnsetTriggerEvents(gridId, selectedRange.start, selectedRange.end),
        ])
        if (!cancelled) {
          setTimeline(timelineResponse)
          setTriggerEvents(triggerResponse.events || [])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [gridId, hasSelectedRange, selectedRange.end, selectedRange.start])

  const seasons = useMemo(() => {
    return Array.from(new Set(triggerEvents.map((event) => event.season_year))).sort((a, b) => a - b)
  }, [triggerEvents])

  const chartData = useMemo<ChartRow[]>(() => {
    const byOffset = new Map<number, ChartRow>()
    for (const event of triggerEvents) {
      const row = byOffset.get(event.day_offset) || { dayOffset: event.day_offset }
      row[`season_${event.season_year}`] = seasons.indexOf(event.season_year)
      row[`season_${event.season_year}_date`] = event.flag_date
      row[`season_${event.season_year}_rain`] = event.rainfall_3day_total
      row[`season_${event.season_year}_accepted`] = event.accepted_onset ? 1 : 0
      byOffset.set(event.day_offset, row)
    }
    return Array.from(byOffset.values()).sort((a, b) => a.dayOffset - b.dayOffset)
  }, [seasons, triggerEvents])

  const chartWidth = `${Math.round(chartZoom * 100)}%`
  const dotRadius = chartZoom > 1 ? 5.5 : 4.5
  const activeDotRadius = chartZoom > 1 ? 7 : 6

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#f0f4f8] px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-bold text-[#0F2A3D]">Seasonal Timeline</h3>
            <ScientificTooltip text={TOOLTIP_TEXT.timeline} />
          </div>
          {!gridId && (
            <p className="mt-0.5 text-[12px] font-semibold text-[#6b7a8d]">
              Search specific area to view the true onset trigger events date
            </p>
          )}
        </div>
        <div className="relative z-[1300] flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1.5 text-[12px] font-bold text-[#6b7a8d]">
            Enter season range
          </span>
          <input value={customStart} onChange={(event) => setCustomStart(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={availableYears[0] ? String(availableYears[0]) : "Start"} className="w-20 rounded-md border border-[#e2e8f0] px-2 py-1.5 text-[12px] font-semibold outline-none focus:border-[#0F2A3D]" />
          <input value={customEnd} onChange={(event) => setCustomEnd(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={availableYears.at(-1) ? String(availableYears.at(-1)) : "End"} className="w-20 rounded-md border border-[#e2e8f0] px-2 py-1.5 text-[12px] font-semibold outline-none focus:border-[#0F2A3D]" />
        </div>
      </div>

      <div className="grid gap-3 p-6 md:grid-cols-3">
        <SummaryTile label="P10" value={timeline?.p10_onset_date} tooltip={TOOLTIP_TEXT.p10} loading={loading} />
        <SummaryTile label="Median Onset" value={timeline?.median_onset_date} tooltip={TOOLTIP_TEXT.median} loading={loading} />
        <SummaryTile label="P90" value={timeline?.p90_onset_date} tooltip={TOOLTIP_TEXT.p90} loading={loading} />
      </div>

      <div className="border-t border-[#f0f4f8] px-6 py-5">
        {chartData.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] font-semibold text-[#6b7a8d]">
              Graph zoom: {Math.round(chartZoom * 100)}%
            </p>
            <div className="flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-1">
              <button
                type="button"
                onClick={() => setChartZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))}
                disabled={chartZoom <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#0F2A3D] transition hover:bg-white disabled:cursor-not-allowed disabled:text-[#94a3b8]"
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setChartZoom(1)}
                disabled={chartZoom === 1}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#0F2A3D] transition hover:bg-white disabled:cursor-not-allowed disabled:text-[#94a3b8]"
                title="Reset zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setChartZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}
                disabled={chartZoom >= 3}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#0F2A3D] transition hover:bg-white disabled:cursor-not-allowed disabled:text-[#94a3b8]"
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="flex h-[280px] items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#1F7A63] border-t-transparent" />
          </div>
        ) : !hasSelectedRange ? (
          <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-[#d6dee8] bg-[#f8fafc] px-4 text-center">
            <p className="max-w-md text-[13px] font-medium text-[#6b7a8d]">
              Enter or choose a season range within the available seasons before viewing grid-level true onset dates.
            </p>
          </div>
        ) : chartData.length ? (
          <div className="w-full overflow-x-auto overflow-y-hidden rounded-lg border border-[#edf2f7] bg-white">
            <div className="h-[300px]" style={{ width: chartWidth, minWidth: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 12 }}>
                <CartesianGrid stroke="#edf2f7" strokeDasharray="3 3" />
                <XAxis
                  dataKey="dayOffset"
                  type="number"
                  domain={[0, 181]}
                  ticks={MONTH_TICKS.map((tick) => tick.value)}
                  tickFormatter={(value) => MONTH_TICKS.find((tick) => tick.value === value)?.label || ""}
                  tick={{ fontSize: 11, fill: "#64748b", fontWeight: 700 }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  domain={[-0.5, Math.max(0.5, seasons.length - 0.5)]}
                  ticks={seasons.map((_season, index) => index)}
                  tickFormatter={(value) => formatSeason(seasons[Number(value)] || seasons[0])}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={76}
                />
                <Tooltip
                  formatter={(value: number, name: string, payload: any) => {
                    const seasonYear = Number(String(name).replace("season_", ""))
                    const row = payload?.payload as ChartRow | undefined
                    const rain = row?.[`season_${seasonYear}_rain`]
                    const accepted = row?.[`season_${seasonYear}_accepted`] === 1
                    return [
                      `${accepted ? "Accepted onset" : "Valid trigger"}${typeof rain === "number" ? ` / 3-day rain ${rain}mm` : ""}`,
                      formatSeason(seasonYear),
                    ]
                  }}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as ChartRow | undefined
                    if (!row) return String(label)
                    const firstDate = Object.entries(row).find(([key]) => key.endsWith("_date"))?.[1]
                    return typeof firstDate === "string" ? formatDayOnly(firstDate) : String(label)
                  }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  labelStyle={{ color: "#0F2A3D", fontWeight: 800 }}
                />
                {seasons.map((seasonYear, index) => (
                  <Line
                    key={seasonYear}
                    type="linear"
                    dataKey={`season_${seasonYear}`}
                    name={`season_${seasonYear}`}
                    stroke={lineColor(index)}
                    strokeWidth={2.5}
                    connectNulls={false}
                    dot={{ r: dotRadius, fill: lineColor(index), stroke: "#ffffff", strokeWidth: 2 }}
                    activeDot={{ r: activeDotRadius, fill: "#0F2A3D", stroke: "#ffffff", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            </div>
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

function formatDayOnly(value?: string | null) {
  const date = parseDate(value)
  if (!date) return "-"
  const day = String(date.getDate()).padStart(2, "0")
  const month = date.toLocaleDateString(undefined, { month: "short" })
  return `${day}/${month}`
}

function formatDate(value?: string | null) {
  const date = parseDate(value)
  if (!date) return "-"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function formatSeason(year: number) {
  return `${year}-${String(year + 1).slice(-2)}`
}

function formatAvailableSeasons(years: number[]) {
  if (!years.length) return "none loaded"
  return years.map(formatSeason).join(", ")
}

function lineColor(index: number) {
  const colors = ["#1F7A63", "#2563eb", "#D64545", "#7c3aed", "#ca8a04", "#0f766e"]
  return colors[index % colors.length]
}
