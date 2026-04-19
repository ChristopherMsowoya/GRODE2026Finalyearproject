"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts"
import { TrendingUp, MapPin, ArrowLeft, Thermometer, Loader2 } from "lucide-react"
import { fetchDistrictSummary, type DistrictSummary } from "@/lib/algorithm-api"

// ─── Custom bar tooltip ───────────────────────────────────────────────────────
function RiskTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3.5 py-2.5 text-[12px]" style={{ background:"#0F2A3D", color:"#fff", boxShadow:"0 8px 24px rgba(15,42,61,0.3)" }}>
      <p className="font-bold mb-1">{label}</p>
      <p>Probability: <span className="font-black">{payload[0]?.value}%</span></p>
    </div>
  )
}

// ─── Heat stress gradient bar ─────────────────────────────────────────────────
function StatusTimelineBar({ label, value, date }: { label: string; value: number; date: string | null }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t) }, [])
  return (
    <div className="space-y-1.5 mb-5">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-[#6b7a8d]">
        <span>{label}</span>
        <span className="text-[#0F2A3D]">{date || "Pending"}</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-[#f0f4f8]">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: animated ? `${value}%` : "0%",
            background: "linear-gradient(to right, #1F7A63 0%, #0F2A3D 100%)",
          }}
        />
      </div>
    </div>
  )
}

// ─── Bottom metric card ───────────────────────────────────────────────────────
function MetricCard({ label, value, unit, badge, badgeColor, borderColor }:
  { label:string; value:string; unit?:string; badge:string; badgeColor:string; borderColor:string }) {
  return (
    <div className="rounded-2xl bg-white p-6" style={{ boxShadow:"0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0", borderLeft:`4px solid ${borderColor}` }}>
      <span className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color:"#6b7a8d" }}>{label}</span>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[40px] font-black leading-none tracking-tight" style={{ color:"#0F2A3D" }}>{value}</span>
        {unit && <span className="text-[14px] font-bold" style={{ color:"#6b7a8d" }}>{unit}</span>}
        <span className="ml-1 text-[13px] font-bold" style={{ color:badgeColor }}>{badge}</span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HistoricalPage() {
  const searchParams = useSearchParams()
  const defaultDistrict = searchParams.get("district") || "Lilongwe Central"
  
  const [districtData, setDistrictData] = useState<DistrictSummary | null>(null)
  const [loading, setLoading] = useState(true)
  
  const chartData = districtData ? [
    { name: "False Onset Probability", value: Math.round(districtData.average_false_onset_probability * 100), highlight: districtData.average_false_onset_probability > 0.4 },
    { name: "Crop Stress Probability", value: Math.round(districtData.average_crop_stress_probability * 100), highlight: districtData.average_crop_stress_probability > 0.4 },
    { name: "Onset Detection Rate", value: Math.round(districtData.onset_detection_rate * 100), highlight: false },
    { name: "Overall Risk Likelihood", value: Math.round(districtData.overall_risk_probability * 100), highlight: districtData.overall_risk_probability > 0.4 },
  ] : []

  useEffect(() => {
    let cancelled = false
    async function loadData() {
      try {
        const ds = await fetchDistrictSummary()
        if (cancelled) return
        
        const districtObj = ds.districts.find(d => d.district.toLowerCase() === defaultDistrict.toLowerCase())
        if (districtObj) {
          setDistrictData(districtObj)
        }
      } catch (error) {
        console.error("Failed to fetch historical intelligence:", error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [defaultDistrict])

  return (
    <div className="space-y-6 max-w-full">

      {/* ── Back breadcrumb ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Link href="/map" className="flex items-center gap-1.5 text-[12.5px] font-semibold transition-colors hover:text-[#0F2A3D]" style={{ color:"#6b7a8d" }}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Spatial Risk Map
        </Link>
        <span className="text-[#6b7a8d]">/</span>
        <span className="text-[12.5px] font-semibold" style={{ color:"#0F2A3D" }}>Historical Trends</span>
      </div>

      {/* ── Hero row ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4" style={{ color:"#1F7A63" }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color:"#1F7A63" }}>{defaultDistrict}</span>
          </div>
          <h1 className="text-[38px] font-extrabold leading-tight tracking-tight" style={{ color:"#0F2A3D" }}>
            {defaultDistrict}
          </h1>
          <p className="mt-1 text-[14px]" style={{ color:"#6b7a8d" }}>
            Historical Rainfall &amp; Temperature Intelligence {districtData ? `(${districtData.seasons_analyzed} Seasons Analysed)` : "(2014—2024)"}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-shrink-0 items-center gap-3 pt-2">
          {loading && <div className="flex items-center gap-2 text-sm text-[#0F2A3D] font-medium"><Loader2 className="h-4 w-4 animate-spin text-[#1F7A63]" /> Tracking Live Integrations...</div>}
        </div>
      </div>

      {/* ── Main: Risk Probability Chart ───────────────────── */}
      <div>
        <div className="rounded-2xl bg-white p-6" style={{ boxShadow:"0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-[18px] font-bold" style={{ color:"#0F2A3D" }}>Analyzed Pipeline Probabilities</h2>
              <p className="text-[12.5px] mt-0.5" style={{ color:"#6b7a8d" }}>
                Algorithmic likelihoods of environmental disruptions across all tracked grids
              </p>
            </div>
            <div className="flex items-center gap-4 text-[12px] font-bold">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#D64545]" /> HIGH RISK</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#0F2A3D]" /> OPTIMAL</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barGap={4} barCategoryGap="35%">
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize:11, fill:"#6b7a8d", fontWeight:600 }} />
              <YAxis hide domain={[0, 100]} />
              <Tooltip content={<RiskTooltip />} cursor={{ fill:"rgba(15,42,61,0.04)" }} />
              <ReferenceLine y={50} stroke="#e2e8f0" strokeDasharray="4 4" />
              <Bar dataKey="value" radius={[5,5,0,0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.highlight ? "#D64545" : "#0F2A3D"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background:"#D64545" }}>
              Alert Zone
            </span>
            <span className="text-[12px]" style={{ color:"#6b7a8d" }}>
              Metrics crossing the 50% probability threshold trigger environmental advisories
            </span>
          </div>
        </div>
      </div>

      {/* ── Second row: Heat Stress + Vegetation Health ───────────────────── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Detection Timeline */}
        <div className="rounded-2xl bg-white p-6" style={{ boxShadow:"0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[17px] font-bold" style={{ color:"#0F2A3D" }}>Pipeline Timeframes</h2>
            <Thermometer className="h-5 w-5" style={{ color:"#1F7A63" }} />
          </div>

          <div className="space-y-2 mb-5">
            <StatusTimelineBar 
              label="Early Extraction" 
              value={40} 
              date={districtData?.first_detected_onset_date ? new Date(districtData.first_detected_onset_date).toLocaleDateString() : null} 
            />
            <StatusTimelineBar 
              label="Final Calculation" 
              value={100} 
              date={districtData?.latest_detected_onset_date ? new Date(districtData.latest_detected_onset_date).toLocaleDateString() : null} 
            />
          </div>

          <div className="flex items-center justify-between pt-4" style={{ borderTop:"1px solid #f0f4f8" }}>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color:"#0F2A3D" }} />
              <span className="text-[13px] font-semibold" style={{ color:"#1a2332" }}>Seasons Iterated</span>
            </div>
            <span className="text-[16px] font-black" style={{ color:"#0F2A3D" }}>{districtData ? districtData.seasons_analyzed : 0} Years</span>
          </div>
        </div>

        {/* Vegetation Health Index */}
        <div className="relative overflow-hidden rounded-2xl group cursor-pointer" style={{ minHeight:"280px" }}>
          <Image src="/satellite_farmland.png" alt="Vegetation Health — NDVI satellite imagery" fill className="object-cover object-center transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0" style={{ background:"linear-gradient(to top, rgba(10,25,40,0.85) 0%, rgba(10,25,40,0.35) 55%, transparent 100%)" }} />
          <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
            <div>
              <h3 className="text-[20px] font-extrabold text-white leading-tight">Vegetation Health Index</h3>
              <p className="mt-1 text-[12.5px] text-white/70 max-w-[240px] leading-snug">
                Comparing 2024 NDVI density against the 10-year historic peak.
              </p>
            </div>
            <Link
              href="/map/full"
              className="flex items-center gap-1.5 flex-shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all hover:opacity-90 active:scale-95"
              style={{ background:"rgba(255,255,255,0.90)", color:"#0F2A3D", backdropFilter:"blur(8px)" }}
            >
              Explore Map
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom 3-column metrics ───────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-5">
        <MetricCard label="Stability Score"     value={districtData ? `${(100 - (districtData.average_crop_stress_probability * 100)).toFixed(0)}%` : "84%"}  badge={districtData?.overall_risk_level === 'High' ? "At Risk" : "Stable"}     badgeColor={districtData?.overall_risk_level === 'High' ? "#D64545" : "#1F7A63"} borderColor={districtData?.overall_risk_level === 'High' ? "#D64545" : "#1F7A63"} />
        <MetricCard label="Dry Spell Likelihood" value={districtData ? `${(districtData.average_false_onset_probability * 100).toFixed(1)}%` : "24%"}  unit="Propensity"  badge=""             badgeColor="#F4A261" borderColor="#F4A261" />
        <MetricCard label="Grid Cells Tracked"    value={districtData ? `${districtData.grid_cell_count}` : "High"} badge="Coverage" badgeColor="#0F2A3D" borderColor="#0F2A3D" />
      </div>

    </div>
  )
}
