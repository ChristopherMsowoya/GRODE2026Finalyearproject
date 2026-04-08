"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts"
import { TrendingUp, MapPin, ArrowLeft, Thermometer } from "lucide-react"

// ─── Rainfall data ────────────────────────────────────────────────────────────
const PERIODS = {
  "10 Years": [
    { year:"2015", observed:820,  mean:790, highlight:false },
    { year:"2016", observed:750,  mean:790, highlight:false },
    { year:"2017", observed:680,  mean:790, highlight:false },
    { year:"2018", observed:440,  mean:790, highlight:true  },  // drought
    { year:"2019", observed:760,  mean:790, highlight:false },
    { year:"2020", observed:870,  mean:790, highlight:false },
    { year:"2021", observed:1020, mean:790, highlight:false },
    { year:"2022", observed:700,  mean:790, highlight:false },
    { year:"2023", observed:640,  mean:790, highlight:false },
    { year:"2024", observed:390,  mean:790, highlight:true  },  // drought risk
  ],
  "5 Years": [
    { year:"2020", observed:870,  mean:790, highlight:false },
    { year:"2021", observed:1020, mean:790, highlight:false },
    { year:"2022", observed:700,  mean:790, highlight:false },
    { year:"2023", observed:640,  mean:790, highlight:false },
    { year:"2024", observed:390,  mean:790, highlight:true  },
  ],
  "Last Season": [
    { year:"Oct",  observed:120, mean:110, highlight:false },
    { year:"Nov",  observed:210, mean:195, highlight:false },
    { year:"Dec",  observed:280, mean:260, highlight:false },
    { year:"Jan",  observed:185, mean:220, highlight:true  },
    { year:"Feb",  observed:90,  mean:140, highlight:true  },
  ],
}

// ─── Custom bar tooltip ───────────────────────────────────────────────────────
function RainfallTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3.5 py-2.5 text-[12px]" style={{ background:"#0F2A3D", color:"#fff", boxShadow:"0 8px 24px rgba(15,42,61,0.3)" }}>
      <p className="font-bold mb-1">{label}</p>
      <p>Observed: <span className="font-black">{payload[0]?.value} mm</span></p>
      <p style={{ color:"#94a3b8" }}>Mean: {payload[1]?.value} mm</p>
    </div>
  )
}

// ─── Heat stress gradient bar ─────────────────────────────────────────────────
function HeatBar({ value, max = 40 }: { value: number; max?: number }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t) }, [])
  const pct = (value / max) * 100
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full" style={{ background:"#f0f4f8" }}>
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width:      animated ? `${pct}%` : "0%",
          background: "linear-gradient(to right, #16a34a 0%, #eab308 45%, #ef4444 100%)",
        }}
      />
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
  const [period, setPeriod] = useState<keyof typeof PERIODS>("10 Years")
  const data = PERIODS[period]

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
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color:"#1F7A63" }}>Lilongwe Central</span>
          </div>
          <h1 className="text-[38px] font-extrabold leading-tight tracking-tight" style={{ color:"#0F2A3D" }}>
            Lilongwe Central
          </h1>
          <p className="mt-1 text-[14px]" style={{ color:"#6b7a8d" }}>
            Historical Rainfall &amp; Temperature Intelligence (2014—2024)
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-shrink-0 items-center gap-3 pt-2">
          {/* Period pills */}
          <div className="flex items-center gap-1 rounded-full bg-[#f0f4f8] p-1">
            {(Object.keys(PERIODS) as (keyof typeof PERIODS)[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all duration-200"
                style={{
                  background: period === p ? "#fff" : "transparent",
                  color:      period === p ? "#0F2A3D" : "#6b7a8d",
                  boxShadow:  period === p ? "0 1px 4px rgba(15,42,61,0.10)" : "none",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main: Rainfall Chart ───────────────────── */}
      <div>
        {/* Rainfall Chart */}
        <div className="rounded-2xl bg-white p-6" style={{ boxShadow:"0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-[18px] font-bold" style={{ color:"#0F2A3D" }}>Annual Rainfall Distribution</h2>
              <p className="text-[12.5px] mt-0.5" style={{ color:"#6b7a8d" }}>
                Cumulative seasonal precipitation compared to 30-year mean
              </p>
            </div>
            <div className="flex items-center gap-4 text-[12px] font-bold">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#0F2A3D]" /> OBSERVED</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#e2e8f0]" /> MEAN</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} barGap={4} barCategoryGap="28%">
              <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize:11, fill:"#6b7a8d", fontWeight:600 }} />
              <YAxis hide />
              <Tooltip content={<RainfallTooltip />} cursor={{ fill:"rgba(15,42,61,0.04)" }} />
              <ReferenceLine y={790} stroke="#e2e8f0" strokeDasharray="4 4" />
              <Bar dataKey="observed" radius={[5,5,0,0]}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.highlight ? "#D64545" : "#0F2A3D"} />
                ))}
              </Bar>
              <Bar dataKey="mean" radius={[5,5,0,0]} fill="#e2e8f0" />
            </BarChart>
          </ResponsiveContainer>

          {/* Drought Risk annotation legend */}
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background:"#D64545" }}>
              Drought Risk
            </span>
            <span className="text-[12px]" style={{ color:"#6b7a8d" }}>
              Years where observed rainfall fell significantly below the 30-year mean
            </span>
          </div>
        </div>
      </div>

      {/* ── Second row: Heat Stress + Vegetation Health ───────────────────── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Heat Stress Index */}
        <div className="rounded-2xl bg-white p-6" style={{ boxShadow:"0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[17px] font-bold" style={{ color:"#0F2A3D" }}>Heat Stress Index</h2>
            <Thermometer className="h-5 w-5" style={{ color:"#F4A261" }} />
          </div>

          <div className="space-y-4 mb-5">
            {[
              { month:"OCT", value:34 },
              { month:"NOV", value:31 },
              { month:"DEC", value:28 },
            ].map(({ month, value }) => (
              <div key={month} className="flex items-center gap-4">
                <span className="w-8 text-[11px] font-bold uppercase tracking-wide flex-shrink-0" style={{ color:"#6b7a8d" }}>{month}</span>
                <div className="flex-1">
                  <HeatBar value={value} />
                </div>
                <span className="w-10 text-right text-[13px] font-extrabold flex-shrink-0" style={{ color:"#0F2A3D" }}>{value}°C</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4" style={{ borderTop:"1px solid #f0f4f8" }}>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color:"#D64545" }} />
              <span className="text-[13px] font-semibold" style={{ color:"#1a2332" }}>Rising Night Temps</span>
            </div>
            <span className="text-[16px] font-black" style={{ color:"#D64545" }}>+1.2°C</span>
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
        <MetricCard label="Stability Score"     value="84%"  badge="Stable"     badgeColor="#1F7A63" borderColor="#1F7A63" />
        <MetricCard label="Dry Spell Frequency" value="2.4"  unit="Per Season"  badge=""             badgeColor="#F4A261" borderColor="#F4A261" />
        <MetricCard label="Flash Flood Risk"    value="High" badge="Increasing" badgeColor="#D64545" borderColor="#D64545" />
      </div>

    </div>
  )
}
