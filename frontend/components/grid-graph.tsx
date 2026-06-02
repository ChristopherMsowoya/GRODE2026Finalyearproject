"use client"

import { useEffect, useMemo, useState } from "react"
import { Info } from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { fetchGridHistory, fetchSeasonYears } from "@/lib/algorithm-api"
import { type SelectedLocation } from "./location-selector"

interface GridGraphProps {
  location: SelectedLocation | null
  metricType: "onset" | "false_onset" | "dry_spell"
}

type SeasonDiagnostic = {
  season?: string
  season_year?: number | null
  onset_date?: string | null
  false_onset_probability?: number | null
  dry_spell_probability?: number | null
  onset_probability?: number | null
}

type ChartRow = {
  monthOffset: number
  label: string
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

const METRIC_CONFIG = {
  onset: {
    title: "Onset Probability",
    yLabel: "Onset Probability (%)",
    color: "#1F7A63",
  },
  false_onset: {
    title: "False Onset Probability",
    yLabel: "False Onset Probability (%)",
    color: "#D64545",
  },
  dry_spell: {
    title: "Dry Spell Probability",
    yLabel: "Dry Spell Probability (%)",
    color: "#2563eb",
  },
}

export default function GridGraph({ location, metricType }: GridGraphProps) {
  const grid = location?.grid ?? null
  const gridData = location?.gridData ?? null
  const district = location?.district ?? null
  const area = location?.areaName ?? null
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [diagnostics, setDiagnostics] = useState<SeasonDiagnostic[]>([])
  const [loading, setLoading] = useState(false)

  const { title, yLabel, color } = METRIC_CONFIG[metricType]
  const selectedRange = useMemo(() => {
    const start = customStart.length === 4 ? Number(customStart) : null
    const end = customEnd.length === 4 ? Number(customEnd) : null
    if (start !== null && end === null) return { start, end: start }
    if (start === null && end !== null) return { start: end, end }
    return {
      start,
      end,
    }
  }, [customEnd, customStart])
  const hasSelectedRange = selectedRange.start !== null || selectedRange.end !== null

  useEffect(() => {
    let cancelled = false
    fetchSeasonYears().then((response) => {
      if (!cancelled) setAvailableYears(response.available_years || [])
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadSeries() {
      if (!grid || !gridData || !hasSelectedRange) {
        setDiagnostics([])
        return
      }

      setLoading(true)
      try {
        const history = await fetchGridHistory(grid)
        if (cancelled) return
        const filtered = (history.seasons || []).filter((season) => {
          const year = Number(season.season_year)
          if (!Number.isFinite(year)) return false
          if (selectedRange.start !== null && year < selectedRange.start) return false
          if (selectedRange.end !== null && year > selectedRange.end) return false
          return true
        })
        setDiagnostics(filtered)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadSeries()
    return () => { cancelled = true }
  }, [grid, gridData, hasSelectedRange, selectedRange.end, selectedRange.start])

  const seasons = useMemo(() => {
    return diagnostics
      .map((diagnostic) => Number(diagnostic.season_year))
      .filter((year) => Number.isFinite(year))
      .sort((a, b) => a - b)
  }, [diagnostics])

  const chartData = useMemo<ChartRow[]>(() => {
    if (metricType === "false_onset" || metricType === "dry_spell") {
      const byOffset = new Map<number, ChartRow>()
      diagnostics.forEach((diagnostic) => {
        const year = Number(diagnostic.season_year)
        if (!Number.isFinite(year)) return
        const offset = rainySeasonOffset(diagnostic.onset_date)
        const row = byOffset.get(offset) || { monthOffset: offset, label: monthLabelForOffset(offset) }
        row[`season_${year}`] = metricValue(diagnostic, metricType)
        row[`season_${year}_label`] = String(diagnostic.season || formatSeason(year))
        byOffset.set(offset, row)
      })
      return Array.from(byOffset.values()).sort((a, b) => a.monthOffset - b.monthOffset)
    }

    return MONTH_TICKS.map((tick) => {
      const row: ChartRow = { monthOffset: tick.value, label: tick.label }
      diagnostics.forEach((diagnostic) => {
        const year = Number(diagnostic.season_year)
        if (!Number.isFinite(year)) return
        row[`season_${year}`] = metricValue(diagnostic, metricType)
        row[`season_${year}_label`] = String(diagnostic.season || formatSeason(year))
      })
      return row
    })
  }, [diagnostics, metricType])

  const graphTitle = `${title}${district ? ` ${district}` : ""}${area ? ` ${area}` : ""}${grid ? ` ${grid}` : ""}`

  if (!grid || !gridData) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#e2e8f0] bg-[#f8fafc] p-5 text-center sm:p-8">
        <p className="text-[14px] font-semibold text-[#0F2A3D]">{title}</p>
        <p className="text-[12px] text-[#6b7a8d]">Search specific area to view grid-level diagnostics.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="border-b border-[#f0f4f8] px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 break-words text-[15px] font-bold text-[#0F2A3D] sm:text-[16px]">{graphTitle}</h3>
            <ScientificTooltip text={`${title} shown for the selected grid cell only. Each line represents one rainy season in the selected range.`} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <span className="col-span-2 flex items-center justify-center gap-1.5 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1.5 text-[12px] font-bold text-[#6b7a8d] sm:col-span-1">
              Enter season range
              <ScientificTooltip text="Enter the season start years available in the system, for example 2021 to 2025 for seasons 2021-22 through 2025-26." />
            </span>
            <input
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder={availableYears[0] ? String(availableYears[0]) : "Start"}
              className="w-full rounded-lg border border-[#e2e8f0] bg-white px-2 py-1.5 text-[12px] font-semibold text-[#0F2A3D] outline-none focus:border-[#0F2A3D] sm:w-20"
            />
            <input
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder={availableYears.at(-1) ? String(availableYears.at(-1)) : "End"}
              className="w-full rounded-lg border border-[#e2e8f0] bg-white px-2 py-1.5 text-[12px] font-semibold text-[#0F2A3D] outline-none focus:border-[#0F2A3D] sm:w-20"
            />
          </div>
        </div>
      </div>

      <div className="px-4 pb-5 pt-4 sm:px-6">
        {loading ? (
          <div className="h-[240px] flex items-center justify-center">
            <div
              className="h-6 w-6 rounded-full border-2 animate-spin"
              style={{ borderLeftColor: color, borderRightColor: color, borderBottomColor: color, borderTopColor: "transparent" }}
            />
          </div>
        ) : !hasSelectedRange ? (
          <div className="h-[240px] flex items-center justify-center rounded-lg border border-dashed border-[#d6dee8] bg-[#f8fafc] px-4 text-center">
            <p className="text-[13px] font-medium text-[#6b7a8d]">Enter a season range to view grid-level seasonal lines.</p>
          </div>
        ) : chartData.length > 0 && seasons.length > 0 ? (
          <div className="w-full overflow-x-auto overflow-y-hidden rounded-lg border border-[#edf2f7] bg-white">
          <div className="h-[260px] min-w-[640px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                <XAxis
                  dataKey="monthOffset"
                  type="number"
                  domain={[0, 181]}
                  ticks={MONTH_TICKS.map((tick) => tick.value)}
                  tickFormatter={(value) => MONTH_TICKS.find((tick) => tick.value === value)?.label || ""}
                  tick={{ fontSize: 11, fill: "#6b7a8d", fontWeight: 700 }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={{ fontSize: 11, fill: "#6b7a8d" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value}%`}
                  label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 12, style: { fontSize: 10, fill: "#6b7a8d" } }}
                />
                <Tooltip
                  formatter={(value: number, name: string, payload: any) => {
                    const seasonYear = Number(String(name).replace("season_", ""))
                    const row = payload?.payload as ChartRow | undefined
                    const seasonLabel = row?.[`season_${seasonYear}_label`]
                    return [`${value}%`, typeof seasonLabel === "string" ? seasonLabel : formatSeason(seasonYear)]
                  }}
                  labelFormatter={(label) => monthLabelForOffset(Number(label))}
                  labelStyle={{ color: "#0F2A3D", fontWeight: 700, fontSize: 12 }}
                  contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                {seasons.map((seasonYear, index) => (
                  <Line
                    key={seasonYear}
                    type="monotone"
                    dataKey={`season_${seasonYear}`}
                    name={`season_${seasonYear}`}
                    stroke={lineColor(index)}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: lineColor(index), strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: lineColor(index) }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          </div>
        ) : (
          <div className="h-[240px] flex items-center justify-center">
            <p className="text-[13px] text-[#6b7a8d]">No seasonal data available for this grid cell and season range.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function metricValue(payload: SeasonDiagnostic, metricType: GridGraphProps["metricType"]) {
  if (metricType === "false_onset") return Math.round(Number(payload.false_onset_probability ?? 0) * 100)
  if (metricType === "dry_spell") return Math.round(Number(payload.dry_spell_probability ?? 0) * 100)
  return Math.round(Number(payload.onset_probability ?? 0) * 100)
}

function formatSeason(year: number) {
  if (!Number.isFinite(year)) return "Season"
  return `${year}-${String(year + 1).slice(-2)}`
}

function lineColor(index: number) {
  const colors = ["#D64545", "#2563eb", "#1F7A63", "#7c3aed", "#ca8a04", "#0f766e"]
  return colors[index % colors.length]
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value.replace(" ", "T"))
  return Number.isNaN(date.getTime()) ? null : date
}

function rainySeasonOffset(value?: string | null) {
  const date = parseDate(value)
  if (!date) return 0
  const seasonStartYear = date.getMonth() + 1 <= 4 ? date.getFullYear() - 1 : date.getFullYear()
  const seasonStart = new Date(seasonStartYear, 10, 1)
  return Math.max(0, Math.round((date.getTime() - seasonStart.getTime()) / 86400000))
}

function monthLabelForOffset(value: number) {
  if (value >= 151) return "Apr"
  if (value >= 120) return "Mar"
  if (value >= 92) return "Feb"
  if (value >= 61) return "Jan"
  if (value >= 30) return "Dec"
  return "Nov"
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
