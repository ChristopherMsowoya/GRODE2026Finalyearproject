"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Download,
  Phone,
  BarChart3,
  Thermometer,
  Bug,
  Waves,
  MapPin,
  ChevronRight,
  Leaf,
} from "lucide-react"
import Image from "next/image"

// ─── Bar Chart (Precipitation) ──────────────────────────────────────────────
const CHART_DATA = [
  { month: "Sept", value: 38, highlight: false },
  { month: "Oct",  value: 54, highlight: false },
  { month: "Nov",  value: 88, highlight: true  },
  { month: "Dec",  value: 67, highlight: false },
  { month: "Jan",  value: 45, highlight: false },
]
const MAX_VAL = Math.max(...CHART_DATA.map(d => d.value))

function PrecipChart() {
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative flex items-end justify-between gap-3 h-36 mt-4">
      {CHART_DATA.map((d) => {
        const heightPct = (d.value / MAX_VAL) * 100
        return (
          <div key={d.month} className="flex flex-1 flex-col items-center gap-2">
            <div className="w-full flex items-end justify-center" style={{ height: "120px" }}>
              <div
                className="relative w-full rounded-t-lg transition-all duration-700 ease-out"
                style={{
                  height: animated ? `${heightPct}%` : "0%",
                  background: d.highlight
                    ? "linear-gradient(to top, #1F7A63, #2aab87)"
                    : "linear-gradient(to top, #d1dae4, #e8edf3)",
                  boxShadow: d.highlight ? "0 4px 16px rgba(31,122,99,0.30)" : "none",
                }}
              >
                {d.highlight && (
                  <span
                    className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                    style={{ background: "#1F7A63" }}
                  >
                    Peak
                  </span>
                )}
              </div>
            </div>
            <span
              className="text-[11px] font-bold uppercase tracking-wide"
              style={{ color: d.highlight ? "#1F7A63" : "#6b7a8d" }}
            >
              {d.month}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Risk level badge ─────────────────────────────────────────────────────────
function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, { color: string; bg: string; barColor: string; barWidth: string }> = {
    Moderate: { color: "#F4A261", bg: "rgba(244,162,97,0.12)", barColor: "#F4A261", barWidth: "55%" },
    Low:      { color: "#1F7A63", bg: "rgba(31,122,99,0.10)",  barColor: "#1F7A63", barWidth: "22%" },
    High:     { color: "#D64545", bg: "rgba(214,69,69,0.10)",  barColor: "#D64545", barWidth: "88%" },
  }
  const s = styles[level] || styles.Moderate
  return (
    <div className="flex items-center gap-3">
      <span
        className="rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide"
        style={{ color: s.color, background: s.bg }}
      >
        {level}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-[#e8edf3] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: s.barWidth, background: s.barColor }} />
      </div>
    </div>
  )
}

// ─── Status pill ─────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    Stable:   { color: "#1F7A63", bg: "rgba(31,122,99,0.12)"  },
    Variable: { color: "#F4A261", bg: "rgba(244,162,97,0.12)" },
    Critical: { color: "#D64545", bg: "rgba(214,69,69,0.12)"  },
    Optimal:  { color: "#1F7A63", bg: "rgba(31,122,99,0.12)"  },
    Monitor:  { color: "#F4A261", bg: "rgba(244,162,97,0.12)" },
  }
  const s = map[status] || map.Stable
  return (
    <span
      className="rounded-full px-3 py-0.5 text-[10.5px] font-bold uppercase tracking-widest"
      style={{ color: s.color, background: s.bg }}
    >
      {status}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DetailsPage() {
  const router = useRouter()

  return (
    <div className="space-y-6 max-w-full">

      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl px-8 py-10"
        style={{
          background: "linear-gradient(135deg, #0A1F2E 0%, #0F2A3D 45%, #133a4a 100%)",
          minHeight: "180px",
        }}
      >
        {/* Subtle pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='30' cy='30' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: "30px 30px",
          }}
        />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-3.5 w-3.5" style={{ color: "#1F7A63" }} />
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#1F7A63" }}>
                Lilongwe Central, Malawi
              </span>
            </div>
          </div>
          <div
            className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl ml-8"
            style={{ background: "rgba(31,122,99,0.18)", border: "1px solid rgba(31,122,99,0.35)" }}
          >
            <Leaf className="h-10 w-10" style={{ color: "#2aab87" }} />
          </div>
        </div>
      </div>

      {/* ── Forecast Panel ────────────────────────────────────────────────── */}
      <div>

        {/* Forecast Card */}
        <div
          className="rounded-2xl bg-white p-6"
          style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}
        >
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: "rgba(31,122,99,0.12)" }}
                >
                  <BarChart3 className="h-4 w-4" style={{ color: "#1F7A63" }} />
                </div>
                <h2 className="text-[18px] font-bold" style={{ color: "#0F2A3D" }}>
                  Detailed Forecast
                </h2>
              </div>
              <p className="text-[12.5px]" style={{ color: "#6b7a8d" }}>
                Projected Precipitation vs. Soil Saturation
              </p>
            </div>
            <span
              className="rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ background: "#E9F5EC", color: "#1F7A63", border: "1px solid rgba(31,122,99,0.25)" }}
            >
              Optimal Window
            </span>
          </div>

          {/* Chart */}
          <PrecipChart />

          {/* Metric duo */}
          <div className="mt-6 grid grid-cols-2 gap-4 pt-5 border-t border-[#f0f4f8]">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest block" style={{ color: "#6b7a8d" }}>
                Rain Probability
              </span>
              <span className="text-[26px] font-black leading-tight tracking-tight mt-1 block" style={{ color: "#0F2A3D" }}>
                82%
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest block" style={{ color: "#6b7a8d" }}>
                False Onset
              </span>
              <span className="text-[26px] font-black leading-tight tracking-tight mt-1 block" style={{ color: "#D64545" }}>
                Low
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Regional Impact ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[20px] font-bold" style={{ color: "#0F2A3D" }}>Regional Impact</h2>
            <p className="text-[12.5px] mt-0.5" style={{ color: "#6b7a8d" }}>
              Comparative climate metrics across neighbouring districts
            </p>
          </div>
          <button
            onClick={() => router.push('/map/full')}
            className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-[12.5px] font-semibold transition-all duration-200 hover:bg-[#f0f4f8]"
            style={{ border: "1.5px solid #e2e8f0", color: "#0F2A3D" }}
          >
            Expand Map View
            <TrendingUp className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {[
            { name: "Lilongwe", status: "Stable",   img: "/soil_moisture.png"       },
            { name: "Dedza",    status: "Variable",  img: "/satellite_farmland.png"  },
            { name: "Mchinji",  status: "Stable",    img: "/farmland_hero.png"       },
          ].map(({ name, status, img }) => (
            <div
              key={name}
              className="group relative h-48 overflow-hidden rounded-2xl cursor-pointer"
              style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.12)" }}
            >
              <Image
                src={img}
                alt={`${name} district climate view`}
                fill
                className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                <span className="text-[15px] font-bold text-white">{name}</span>
                <StatusPill status={status} />
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* ── Expert Consultation Footer ────────────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-2xl px-8 py-6"
        style={{
          background: "#f8fafd",
          border: "1.5px solid #e2e8f0",
        }}
      >
        <div>
          <h3 className="text-[17px] font-bold" style={{ color: "#0F2A3D" }}>
            Expert Consultation Available
          </h3>
          <p className="text-[13px] mt-1" style={{ color: "#6b7a8d" }}>
            Need a customised report for your cooperative or farm size?
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-2 rounded-xl px-6 py-3 text-[13.5px] font-bold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95"
            style={{ background: "linear-gradient(135deg, #0F2A3D 0%, #1F7A63 100%)" }}
          >
            <Phone className="h-4 w-4" />
            Schedule Call
          </button>
          <button
            className="flex items-center gap-2 rounded-xl border px-6 py-3 text-[13.5px] font-semibold transition-all duration-200 hover:bg-[#f0f4f8] active:scale-95"
            style={{ border: "1.5px solid #e2e8f0", color: "#1a2332" }}
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

    </div>
  )
}
