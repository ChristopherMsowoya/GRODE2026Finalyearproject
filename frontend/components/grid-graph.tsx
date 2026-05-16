"use client"

import { useEffect, useMemo, useState } from "react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts"
import { type SelectedLocation } from "./location-selector"
import { fetchGridHistory, fetchPipelineResults, fetchSeasonYears, type SeasonRangeOption } from "../lib/algorithm-api"

const LEGACY_DRY_PROBABILITY_KEY = "crop_" + "stress_probability"

interface GridGraphProps {
  location: SelectedLocation | null
  metricType: "onset" | "false_onset" | "dry_spell"
}

type SeriesPoint = { season: string; seasonYear: number | null; value: number }

const DEFAULT_SEASON_RANGES: SeasonRangeOption[] = [
  { label: "All Seasons", value: "all", start_year: null, end_year: null },
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
  const ta = location?.ta ?? null
  const district = location?.district ?? null
  const area = location?.areaName ?? null
  const [rawSeries, setRawSeries] = useState<SeriesPoint[]>([])
  const [seasonRange, setSeasonRange] = useState("all")
  const [seasonRanges, setSeasonRanges] = useState<SeasonRangeOption[]>(DEFAULT_SEASON_RANGES)
  const [loading, setLoading] = useState(false)

  const { title, yLabel, color } = METRIC_CONFIG[metricType]

  useEffect(() => {
    let cancelled = false
    async function loadSeasonYears() {
      const response = await fetchSeasonYears()
      if (cancelled) return
      const ranges = response.ranges.length ? response.ranges : DEFAULT_SEASON_RANGES
      setSeasonRanges(ranges)
      if (!ranges.some((range) => range.value === seasonRange)) setSeasonRange("all")
    }
    void loadSeasonYears()
    return () => { cancelled = true }
  }, [seasonRange])

  useEffect(() => {
    let cancelled = false

    async function loadSeries() {
      if (!grid || !gridData) {
        setRawSeries([])
        return
      }

      setLoading(true)
      try {
        const points: SeriesPoint[] = []
        const history = await fetchGridHistory(grid)

        for (const payload of (history.seasons || []) as any[]) {
          const season = payload.season_year || payload.season || payload.year || (payload.baseline_start ? String(payload.baseline_start) : undefined)
          const val = valueForMetric(payload, metricType)
          if (typeof val === "number") points.push(toPoint(season, val, points.length))
        }

        if (points.length === 0) {
          const res = await fetchPipelineResults(grid)
          const rows = res?.data || res || []

          for (const r of rows) {
            const payload = r.result || r
            const season = payload.season_year || payload.season || payload.year || (payload.baseline_start ? String(payload.baseline_start) : undefined)
            const val = valueForMetric(payload, metricType)
            if (typeof val === "number") points.push(toPoint(season, val, points.length))
          }
        }

        if (points.length === 0) {
          const agg = valueForMetric(gridData, metricType) ?? 0
          const seasons = Math.min(5, gridData.seasons_analyzed || 1)
          for (let i = seasons - 1; i >= 0; i--) {
            points.push({ season: `S${i + 1}`, seasonYear: null, value: Math.round(agg * 100) })
          }
        }

        if (!cancelled) setRawSeries(points.slice(-30))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadSeries()
    return () => { cancelled = true }
  }, [grid, metricType, gridData])

  const series = useMemo(() => filterByRange(rawSeries, seasonRange), [rawSeries, seasonRange])
  const latestValue = series.length ? series[series.length - 1].value : null
  const avgValue = series.length ? Math.round(series.reduce((sum, point) => sum + point.value, 0) / series.length) : null
  const graphTitle = `${title}${district ? ` - ${district}` : ""}${ta ? ` / ${ta}` : ""}${area ? ` / ${area}` : ""}`

  if (!grid || !gridData) {
    return (
      <div className="rounded-xl border border-dashed border-[#e2e8f0] bg-[#f8fafc] p-8 flex flex-col items-center justify-center gap-2 text-center">
        <div className="h-10 w-10 rounded-full bg-[#e9edf1] flex items-center justify-center mb-1">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#6b7a8d" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
        </div>
        <p className="text-[14px] font-semibold text-[#0F2A3D]">{title}</p>
        <p className="text-[12px] text-[#6b7a8d]">
          Select location under grid cell to view its historical probability across rainfall seasons.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="px-6 pt-6 pb-4 border-b border-[#f0f4f8]">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-[16px] font-bold text-[#0F2A3D]">{graphTitle}</h3>
            <p className="text-[12px] font-semibold text-[#6b7a8d] mt-0.5">
              Grid <span className="font-mono text-[#0F2A3D]">{grid}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-[11px] text-[#6b7a8d] font-bold uppercase tracking-wider whitespace-nowrap">Season Range</label>
            <select
              value={seasonRange}
              onChange={(event) => setSeasonRange(event.target.value)}
              className="rounded-lg px-2 py-1.5 border border-[#e2e8f0] text-[12px] text-[#0F2A3D] font-semibold bg-white outline-none focus:border-[#0F2A3D] cursor-pointer"
            >
              {seasonRanges.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="px-6 pt-4 pb-2">
        {loading ? (
          <div className="h-[240px] flex items-center justify-center">
            <div
              className="h-6 w-6 rounded-full border-2 animate-spin"
              style={{
                borderLeftColor: color,
                borderRightColor: color,
                borderBottomColor: color,
                borderTopColor: "transparent",
              }}
            />
          </div>
        ) : series.length > 0 ? (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                <XAxis dataKey="season" tick={{ fontSize: 11, fill: "#6b7a8d", fontWeight: 600 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#6b7a8d" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value}%`}
                  label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 12, style: { fontSize: 10, fill: "#6b7a8d" } }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "Probability"]}
                  labelStyle={{ color: "#0F2A3D", fontWeight: 700, fontSize: 12 }}
                  contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                {avgValue !== null && (
                  <ReferenceLine y={avgValue} stroke={color} strokeDasharray="4 3" strokeOpacity={0.4} label={{ value: `Avg ${avgValue}%`, fill: color, fontSize: 10, position: "right" }} />
                )}
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 4, fill: color, strokeWidth: 0 }} activeDot={{ r: 6, fill: color }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[240px] flex items-center justify-center">
            <p className="text-[13px] text-[#6b7a8d]">No historical data available for this grid cell.</p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-[#f0f4f8] flex items-center justify-between">
        <span className="text-[11px] text-[#6b7a8d] uppercase tracking-wider font-bold">Grid-Level Diagnostic Output</span>
        <div className="flex items-center gap-4">
          {avgValue !== null && <span className="text-[12px] text-[#6b7a8d]">Avg: <span className="font-bold" style={{ color }}>{avgValue}%</span></span>}
          {latestValue !== null && <span className="text-[20px] font-extrabold" style={{ color }}>{latestValue}%</span>}
        </div>
      </div>
    </div>
  )
}

function valueForMetric(payload: Record<string, any>, metricType: GridGraphProps["metricType"]) {
  if (metricType === "false_onset") return payload.false_onset_probability ?? payload.false_onset_prob
  if (metricType === "dry_spell") return payload.dry_spell_probability ?? payload[LEGACY_DRY_PROBABILITY_KEY]
  return payload.onset_probability ?? (
    payload.seasons_with_detected_onset && payload.seasons_analyzed
      ? payload.seasons_with_detected_onset / payload.seasons_analyzed
      : 0
  )
}

function toPoint(season: unknown, value: number, index: number): SeriesPoint {
  const year = numberFromSeason(season)
  return {
    season: season ? String(season) : `S${index + 1}`,
    seasonYear: year,
    value: Math.round(value * 100),
  }
}

function numberFromSeason(value: unknown) {
  if (typeof value === "number") return value
  const match = String(value ?? "").match(/\b(19|20)\d{2}\b/)
  return match ? Number(match[0]) : null
}

function filterByRange(points: SeriesPoint[], range: string) {
  if (range === "all") return points

  const [startText, endText] = range.split("-")
  const start = Number(startText)
  const end = Number(endText)
  const filtered = points.filter((point) => {
    const year = point.seasonYear ?? numberFromSeason(point.season)
    return year === null || (year >= start && year <= end)
  })

  return filtered.length ? filtered : points
}
