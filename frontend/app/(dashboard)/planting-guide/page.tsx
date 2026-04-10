"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  AlertTriangle,
  Download,
  ExternalLink,
  Leaf,
  Wheat,
  Sprout,
  Shield,
  Layers,
  Droplets,
  CheckCircle2,
} from "lucide-react"

// ─── Animated Risk Meter ──────────────────────────────────────────────────────
function RiskMeter({ percentage = 82 }: { percentage?: number }) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div>
      {/* Track labels */}
      <div className="mb-2 flex justify-between text-[10.5px] font-bold uppercase tracking-widest">
        <span style={{ color: "#4CAF50" }}>Low Risk</span>
        <span style={{ color: "#F4A261" }}>Moderate</span>
        <span style={{ color: "#D64545" }}>High Risk</span>
      </div>

      {/* Track */}
      <div className="relative h-[10px] w-full overflow-visible rounded-full" style={{ background: "#e9ecf0" }}>
        {/* LOW segment */}
        <div
          className="absolute left-0 top-0 h-full rounded-l-full"
          style={{ width: "33%", background: "linear-gradient(to right, #4CAF50, #7FBF7F)" }}
        />
        {/* MEDIUM segment */}
        <div
          className="absolute top-0 h-full"
          style={{ left: "33%", width: "34%", background: "linear-gradient(to right, #F4A261, #f0a050)" }}
        />
        {/* HIGH segment */}
        <div
          className="absolute right-0 top-0 h-full rounded-r-full"
          style={{ left: "67%", width: "33%", background: "linear-gradient(to right, #e85f5f, #D64545)" }}
        />

        {/* Animated indicator */}
        <div
          className="absolute top-0 -translate-y-[10px] -translate-x-1/2 transition-all duration-1000 ease-out"
          style={{ left: animated ? `${percentage}%` : "33%" }}
        >
          <div
            className="h-0 w-0"
            style={{
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "8px solid #D64545",
              margin: "0 auto",
            }}
          />
        </div>
      </div>

      {/* Current label pill */}
      <div className="mt-5 flex justify-end">
        <span
          className="rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest"
          style={{
            background: "rgba(214,69,69,0.12)",
            color: "#D64545",
            border: "1.5px solid rgba(214,69,69,0.25)",
          }}
        >
          Current {percentage}%
        </span>
      </div>

      {/* Action note */}
      <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "#6b7a8d" }}>
        <span className="font-bold" style={{ color: "#D64545" }}>Immediate Action:</span>{" "}
        Avoid dry planting (planting before rains) this week. The 7-day forecast shows zero precipitation with high
        evaporative demand.
      </p>
    </div>
  )
}

// ─── Planting Timeline Bar ────────────────────────────────────────────────────
function PlantingBar({
  earlyLabel,
  optimalStart,
  optimalEnd,
  lateLabel,
  color = "#1F7A63",
}: {
  earlyLabel: string
  optimalStart: string
  optimalEnd: string
  lateLabel: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-2 w-full">
      {/* Early */}
      <div
        className="flex-1 rounded-l-full py-2 text-center text-[11px] font-semibold"
        style={{ background: "#fee2e2", color: "#b91c1c" }}
      >
        {earlyLabel}
      </div>
      {/* Optimal */}
      <div
        className="flex-[2] rounded-md py-2 text-center text-[12px] font-bold text-white"
        style={{ background: color }}
      >
        {optimalStart} – {optimalEnd}
      </div>
      {/* Late */}
      <div
        className="flex-1 rounded-r-full py-2 text-center text-[11px] font-semibold"
        style={{ background: "#fef9c3", color: "#854d0e" }}
      >
        {lateLabel}
      </div>
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const CROPS = [
  {
    icon: Wheat,
    name: "Maize (Hybrid)",
    target: "Target: 35mm accumulated rainfall",
    earlyLabel: "NOV 18-30",
    optimalStart: "DEC 5",
    optimalEnd: "DEC 20",
    lateLabel: "LATE JAN",
    color: "#1F7A63",
  },
  {
    icon: Leaf,
    name: "Soybeans",
    target: "Target: Stable soil temperature",
    earlyLabel: "NOV",
    optimalStart: "DEC 10",
    optimalEnd: "JAN 5",
    lateLabel: "—",
    color: "#1F7A63",
  },
  {
    icon: Sprout,
    name: "Tobacco",
    target: "Target: After first established rains",
    earlyLabel: "—",
    optimalStart: "DEC 15",
    optimalEnd: "30",
    lateLabel: "—",
    color: "#1F7A63",
  },
]

const CROP_CARDS = [
  {
    icon: Wheat,
    title: "Short-Season Maize",
    badge: "Drought Tolerant",
    badgeBg: "#d1fae5",
    badgeColor: "#065f46",
    desc: "Varieties like SC403 or MH26 are recommended this season to ensure maturity before early tail-off of rains.",
    tags: ["Early Maturity", "Heat Resistant"],
  },
  {
    icon: Leaf,
    title: "Intercropping Pigeon Peas",
    badge: "Soil Nitrogen",
    badgeBg: "#dcfce7",
    badgeColor: "#166534",
    desc: "Recommended for Lilongwe South. Intercropping improves soil moisture retention during the forecasted mid-season dry spell.",
    tags: ["Sustainability", "Moisture Fix"],
  },
  {
    icon: Sprout,
    title: "Soybean Varieties",
    badge: "Cash Crop",
    badgeBg: "#fef9c3",
    badgeColor: "#854d0e",
    desc: "Tikolore or Makwacha varieties show the best resilience to the projected erratic late-season rainfall patterns.",
    tags: ["Market Value", "Late Rains"],
  },
]

const RISK_STRATEGIES = [
  {
    icon: Layers,
    color: "#1F7A63",
    bg: "#E9F5EC",
    title: "Staggered Planting",
    desc: "Don't plant your entire field at once. Spread planting over 10 days to hedge against dry spells.",
  },
  {
    icon: Shield,
    color: "#F4A261",
    bg: "#FFF4E5",
    title: "Mulching & Cover",
    desc: "Retain soil moisture by keeping crop residues on the field. This can extend seedling life by 4-5 days.",
  },
  {
    icon: Droplets,
    color: "#3B82F6",
    bg: "#EFF6FF",
    title: "Monitor Soil Moisture",
    desc: "Only plant when the soil is wet to a depth of 30cm (approx. one hand span).",
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PlantingGuidePage() {
  const router = useRouter()

  return (
    <div className="space-y-6 max-w-full">

      {/* ── Alert Banner ───────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-2 w-fit"
        style={{
          background: "rgba(214,69,69,0.12)",
          border: "1.5px solid rgba(214,69,69,0.25)",
        }}
      >
        <AlertTriangle className="h-3.5 w-3.5" style={{ color: "#D64545" }} />
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#D64545" }}>
          High False-Onset Risk
        </span>
      </div>

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-[13px] font-semibold transition-colors hover:opacity-70"
              style={{ color: "#6b7a8d" }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
          <h1
            className="text-[34px] font-extrabold tracking-tight leading-tight"
            style={{ color: "#0F2A3D" }}
          >
            Optimal Planting Guide
          </h1>
          <p className="mt-1.5 text-[14.5px] leading-relaxed max-w-2xl" style={{ color: "#6b7a8d" }}>
            Based on the current 2024/25 rainfall forecast, Lilongwe Central and surrounding districts are
            experiencing a &ldquo;False-Onset&rdquo; pattern. Use this calendar to time your planting for
            maximum yield and minimum seed loss.
          </p>
        </div>
      </div>

      {/* ── Best Planting Dates + Warning Card ────────────────────────────── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 300px" }}>

        {/* LEFT: Planting Dates */}
        <div
          className="rounded-2xl bg-white p-6"
          style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[18px] font-bold" style={{ color: "#0F2A3D" }}>
              Best Planting Dates
            </h2>
            <div className="flex items-center gap-4 text-[11px] font-semibold">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full inline-block" style={{ background: "#1F7A63" }} />
                <span style={{ color: "#6b7a8d" }}>Optimal</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full inline-block" style={{ background: "#F4A261" }} />
                <span style={{ color: "#6b7a8d" }}>Risky</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full inline-block" style={{ background: "#D64545" }} />
                <span style={{ color: "#6b7a8d" }}>Avoid</span>
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {CROPS.map((crop) => {
              const Icon = crop.icon
              return (
                <div key={crop.name}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" style={{ color: "#1F7A63" }} />
                      <span className="text-[13.5px] font-bold" style={{ color: "#0F2A3D" }}>
                        {crop.name}
                      </span>
                    </div>
                    <span className="text-[11px]" style={{ color: "#6b7a8d" }}>
                      {crop.target}
                    </span>
                  </div>
                  <PlantingBar
                    earlyLabel={crop.earlyLabel}
                    optimalStart={crop.optimalStart}
                    optimalEnd={crop.optimalEnd}
                    lateLabel={crop.lateLabel}
                    color={crop.color}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: Warning Card */}
        <div
          className="rounded-2xl p-6 flex flex-col justify-between"
          style={{
            background: "linear-gradient(160deg, #0F2A3D 0%, #1a3d54 100%)",
            boxShadow: "0 2px 16px -4px rgba(15,42,61,0.18)",
          }}
        >
          <div>
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: "rgba(244,162,97,0.20)" }}
            >
              <AlertTriangle className="h-6 w-6" style={{ color: "#F4A261" }} />
            </div>
            <h2 className="text-[22px] font-extrabold leading-tight text-white">
              Wait for &ldquo;True Onset&rdquo;
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.70)" }}>
              Current weather models indicate a dry spell lasting 10-14 days starting November 18th. Farmers who plant
              before this will likely experience 70% seed mortality.
            </p>
          </div>

          <button
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{ background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.25)" }}
          >
            View Local Weather
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Crop Selection Advice ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl bg-white p-6"
        style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-bold" style={{ color: "#0F2A3D" }}>
              Crop Selection Advice
            </h2>
            <p className="text-[13px] mt-0.5" style={{ color: "#6b7a8d" }}>
              Recommended varieties for the 2024/25 climate profile
            </p>
          </div>
          <button
            className="flex items-center gap-1.5 text-[12.5px] font-bold transition-opacity hover:opacity-70"
            style={{ color: "#1F7A63" }}
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF Guide
          </button>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {CROP_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.title}
                className="rounded-xl overflow-hidden border"
                style={{ border: "1px solid #e2e8f0" }}
              >
                {/* Image placeholder with gradient */}
                <div
                  className="relative h-[140px] flex items-end p-3"
                  style={{
                    background: "linear-gradient(160deg, #1F7A63 0%, #0d4a38 100%)",
                  }}
                >
                  <Icon
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 opacity-20"
                    style={{ color: "white" }}
                  />
                  <span
                    className="relative z-10 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: card.badgeBg, color: card.badgeColor }}
                  >
                    {card.badge}
                  </span>
                </div>
                {/* Content */}
                <div className="p-4">
                  <h3 className="text-[14px] font-bold mb-1.5" style={{ color: "#0F2A3D" }}>
                    {card.title}
                  </h3>
                  <p className="text-[12px] leading-relaxed mb-3" style={{ color: "#6b7a8d" }}>
                    {card.desc}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md px-2.5 py-1 text-[10.5px] font-semibold"
                        style={{ background: "#f0f4f8", color: "#475569" }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Risk Management + Risk Meter ──────────────────────────────────── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 340px" }}>

        {/* LEFT: Risk Management Strategies */}
        <div
          className="rounded-2xl bg-white p-6"
          style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}
        >
          <h2 className="text-[22px] font-extrabold mb-1" style={{ color: "#0F2A3D" }}>
            Risk Management<br />Strategies
          </h2>
          <p className="text-[13px] mb-6" style={{ color: "#6b7a8d" }}>
            Implement these techniques to protect your investment during an unpredictable onset.
          </p>

          <div className="space-y-4">
            {RISK_STRATEGIES.map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ background: bg }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div>
                  <h3 className="text-[13.5px] font-bold mb-0.5" style={{ color: "#0F2A3D" }}>
                    {title}
                  </h3>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "#6b7a8d" }}>
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Risk Meter */}
        <div
          className="rounded-2xl bg-white p-6"
          style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}
        >
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[16px] font-bold" style={{ color: "#0F2A3D" }}>
              Risk Meter (Lilongwe)
            </h2>
            <CheckCircle2 className="h-4 w-4" style={{ color: "#D64545" }} />
          </div>
          <p className="text-[12px] mb-5" style={{ color: "#6b7a8d" }}>
            Current false-onset risk assessment
          </p>
          <RiskMeter percentage={82} />
        </div>
      </div>

    </div>
  )
}
