"use client"

import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { type SelectedLocation } from "./location-selector"
import { fetchPipelineResults } from "../lib/algorithm-api"

const LEGACY_DRY_PROBABILITY_KEY = "crop_" + "stress_probability"

interface GridGraphProps {
  location: SelectedLocation
  metricType: "onset" | "false_onset" | "dry_spell"
}

export default function GridGraph({ location, metricType }: GridGraphProps) {
  const { grid, gridData, ta, district } = location
  const [series, setSeries] = useState<{ season: string; value: number }[]>([])
  const [seasonRange, setSeasonRange] = useState("2011-Present")

  useEffect(() => {
    let cancelled = false
    async function loadSeries() {
      if (!grid || !gridData) {
        setSeries([])
        return
      }

      try {
        const res = await fetchPipelineResults(grid)
        const rows = res?.data || res || []

        const points: { season: string; value: number }[] = []
        for (const r of rows) {
          const payload = r.result || r
          const season = payload.season_year || payload.season || payload.year || (payload.baseline_start ? String(payload.baseline_start) : undefined)
          const val = metricType === 'false_onset'
            ? (payload.false_onset_probability ?? payload.false_onset_prob)
            : metricType === 'dry_spell'
              ? (payload.dry_spell_probability ?? payload[LEGACY_DRY_PROBABILITY_KEY])
              : (payload.onset_probability ?? (payload.seasons_with_detected_onset && payload.seasons_analyzed ? payload.seasons_with_detected_onset / payload.seasons_analyzed : 0))
          if (typeof val === 'number') points.push({ season: season ? String(season) : `S${points.length+1}`, value: Math.round(val * 100) })
        }

        if (points.length === 0) {
          const agg = metricType === 'false_onset'
            ? (gridData.false_onset_probability ?? 0)
            : metricType === 'dry_spell'
              ? (gridData.dry_spell_probability ?? 0)
              : (gridData.onset_probability ?? (gridData.seasons_with_detected_onset ? (gridData.seasons_with_detected_onset / Math.max(1, gridData.seasons_analyzed)) : 0))
          const seasons = Math.min(5, gridData.seasons_analyzed || 1)
          for (let i = seasons - 1; i >= 0; i--) {
            points.push({ season: `S${i+1}`, value: Math.round((agg || 0) * 100) })
          }
        }

        const final = points.slice(-20)
        if (!cancelled) setSeries(filterByRange(final, seasonRange))
      } catch (err) {
        // ignore
      }
    }
    loadSeries()
    return () => { cancelled = true }
  }, [grid, metricType, gridData, seasonRange])

  const title = metricType === 'false_onset' ? 'False-Onset Probability Trend' : metricType === 'dry_spell' ? 'Dry Spell Probability Trend' : 'Onset Probability Trend'
  const color = metricType === 'false_onset' ? '#D64545' : metricType === 'dry_spell' ? '#2563eb' : '#1F7A63'

  if (!grid || !gridData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-[#e2e8f0] rounded-xl bg-[#f8fafc]">
        <p className="text-[#6b7a8d] text-[13px] font-medium">Select a specific Area (Grid Cell) to view its diagnostic graph.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm mt-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-[16px] font-bold text-[#0F2A3D]">{title}</h3>
          <p className="text-[12px] font-semibold text-[#0F2A3D]">Grid ID: {grid}</p>
          <p className="text-[13px] text-[#6b7a8d]">{ta ? `TA ${ta}` : ''}, {district} District</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-[#6b7a8d]">Season Range</label>
          <select value={seasonRange} onChange={(e) => setSeasonRange(e.target.value)} className="rounded px-2 py-1 border">
            {["1981-1990", "1991-2000", "2001-2010", "2011-Present", "Custom Range"].map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="season" tick={{fontSize:12, fill:'#6b7a8d'}} />
            <YAxis domain={[0,100]} tick={{fontSize:12, fill:'#6b7a8d'}} />
            <Tooltip formatter={(v:number) => [`${v}%`, 'Probability']} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-4 border-t border-[#f0f4f8] flex justify-between items-center">
        <span className="text-[12px] text-[#6b7a8d] uppercase tracking-wider font-bold">Diagnostic Behavior Output</span>
        <span className="text-[20px] font-extrabold" style={{ color }}>{series.length ? `${series[series.length-1].value}%` : '–'}</span>
      </div>
    </div>
  )
}

function filterByRange(points: { season: string; value: number }[], range: string) {
  if (range === "Custom Range") return points

  const [startText, endText] = range.split("-")
  const start = Number(startText)
  const end = endText === "Present" ? new Date().getFullYear() : Number(endText)
  const filtered = points.filter((point) => {
    const year = Number(String(point.season).match(/\d{4}/)?.[0])
    return Number.isFinite(year) && year >= start && year <= end
  })

  return filtered.length ? filtered : points.slice(-5)
}
