"use client"

import { useEffect, useRef, useState } from "react"
import { useUser } from "@/lib/user-context"
import { getDistrictData } from "@/lib/district-data"
import { CalendarDays, BarChart2, AlertCircle, ChevronDown, X } from "lucide-react"
import Image from "next/image"
import type { DistrictEnvironmentalData } from "@/lib/district-data"

// ─── Timeline marker data ────────────────────────────────────────────────────
function getMarkers(data: DistrictEnvironmentalData) {
  return [
    { id: "p10",    pct: 12,  label: "EARLY (P10)",   date: data.rainfall.p10Date, color: "#1F7A63", size: "sm" as const },
    { id: "median", pct: 50,  label: "MEDIAN ONSET",  date: data.rainfall.medianDate, color: "#0F2A3D", size: "lg" as const },
    { id: "p90",    pct: 88,  label: "LATE (P90)",    date: data.rainfall.p90Date, color: "#d97706", size: "sm" as const },
  ]
}

// Optimal window spans pct 22 → 58 on the bar
const WINDOW_START = 22
const WINDOW_END   = 58

// ─── Info cards ──────────────────────────────────────────────────────────────
const INFO_CARDS = [
  {
    icon:  CalendarDays,
    color: "#1F7A63",
    bg:    "#E9F5EC",
    title: "What is 'Onset'?",
    body:  "Onset is the first significant rainfall event (usually 20mm or more in 3 days) that marks the start of the agricultural season.",
  },
  {
    icon:  BarChart2,
    color: "#0F2A3D",
    bg:    "#e8edf2",
    title: "The P10 & P90 Rule",
    body:  "These dates show the range of uncertainty. P10 is an early start, while P90 represents the latest the rains typically begin.",
  },
  {
    icon:  AlertCircle,
    color: "#d97706",
    bg:    "#FEF3C7",
    title: "Why it matters",
    body:  "Planting too early can lead to crop failure if dry spells follow. Planting too late may shorten the growing season.",
  },
]

// ─── Animated timeline bar ───────────────────────────────────────────────────
function TimelineBar({ markers }: { markers: ReturnType<typeof getMarkers> }) {
  const [animated, setAnimated] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div ref={ref} className="relative py-10">

      {/* ── Optimal window shading ─────────────────────────────────────── */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          left:    `${WINDOW_START}%`,
          width:   `${WINDOW_END - WINDOW_START}%`,
          background: "rgba(31,122,99,0.06)",
          borderLeft:  "1.5px dashed rgba(31,122,99,0.35)",
          borderRight: "1.5px dashed rgba(31,122,99,0.35)",
          borderRadius: "2px",
        }}
      />

      {/* ── Gradient bar ───────────────────────────────────────────────── */}
      <div
        className="relative h-[8px] w-full rounded-full overflow-hidden"
        style={{
          background: "linear-gradient(to right, #2E8B57 0%, #4aab85 22%, #8ecfb8 45%, #cce8df 62%, #e8d5a3 80%, #F4A261 100%)",
        }}
      />

      {/* ── Median bounding indicator lines ────────────────────────────── */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${markers[1].pct}%`,
          top: 0,
          bottom: 0,
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
        }}
      >
      </div>

      {/* ── Labels (below bar) ─────────────────────────────────────────── */}
      <div className="relative mt-5">
        {markers.map(m => (
          <div
            key={m.id}
            className="absolute flex flex-col items-center"
            style={{ left: `${m.pct}%`, transform: "translateX(-50%)" }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-widest mb-1"
              style={{ color: m.color, opacity: 0.85 }}
            >
              {m.label}
            </span>
            <span
              className="font-extrabold leading-none"
              style={{
                color:    m.color,
                fontSize: m.size === "lg" ? "28px" : "17px",
              }}
            >
              {m.date}
            </span>
            {m.size === "lg" && (
              <span className="mt-1 text-[12px]" style={{ color: "#6b7a8d" }}>
                Most likely date
              </span>
            )}
          </div>
        ))}
        {/* Spacer to size the label area */}
        <div style={{ height: "60px" }} />
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function OnsetInfoPage() {
  const { user } = useUser()
  const [selectedDistrict, setSelectedDistrict] = useState<string>("")
  const [showDistrictMenu, setShowDistrictMenu] = useState(false)
  const [districtData, setDistrictData] = useState<DistrictEnvironmentalData | null>(null)

  // Set initial district from user profile if user is logged in
  useEffect(() => {
    if (user?.district) {
      const data = getDistrictData(user.district)
      setDistrictData(data)
      setSelectedDistrict(data.district)
    }
  }, [user])

  // Handle district change
  const handleDistrictChange = (district: string) => {
    const data = getDistrictData(district.toLowerCase())
    setDistrictData(data)
    setSelectedDistrict(data.district)
    setShowDistrictMenu(false)
  }

  if (!districtData) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-[36px] font-extrabold tracking-tight leading-tight"
              style={{ color: "#0F2A3D" }}
            >
              Rainfall Onset Forecast
            </h1>
            <p className="text-[14px] text-[#6b7a8d] mt-1">Select a district to view forecast data</p>
          </div>
          
          {/* District selector dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDistrictMenu(!showDistrictMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e2e8f0] bg-white hover:bg-[#f0f4f8] transition-colors"
            >
              <span className="text-[13px] font-medium text-[#1a2332]">Select District</span>
              <ChevronDown className="h-4 w-4 text-[#6b7a8d]" />
            </button>

            {showDistrictMenu && (
              <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-lg bg-white border border-[#e2e8f0] shadow-lg max-h-64 overflow-y-auto">
                {["Lilongwe", "Blantyre", "Dedza", "Zomba", "Mchinji", "Kasungu", "Mangochi", "Salima", "Nkhotakota"].map((district) => (
                  <button
                    key={district}
                    onClick={() => handleDistrictChange(district)}
                    className={`w-full px-4 py-2 text-left text-[13px] hover:bg-[#f0f4f8] transition-colors ${
                      selectedDistrict === district ? "bg-[#E9F5EC] font-semibold text-[#1F7A63]" : "text-[#1a2332]"
                    }`}
                  >
                    {district}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-8 text-center border border-[#e2e8f0]">
          <AlertCircle className="h-12 w-12 text-[#6b7a8d] mx-auto mb-3" />
          <p className="text-[15px] font-medium text-[#1a2332] mb-2">No district selected</p>
          <p className="text-[14px] text-[#6b7a8d]">Please select a district from the dropdown above to view rainfall onset forecast data.</p>
        </div>
      </div>
    )
  }

  const markers = getMarkers(districtData)
  const optimalStart = markers[0].date
  const optimalEnd = markers[2].date

  return (
    <div className="space-y-6">

      {/* ── Page title with district selector ───────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-[36px] font-extrabold tracking-tight leading-tight"
            style={{ color: "#0F2A3D" }}
          >
            Rainfall Onset Forecast
          </h1>
          <p className="text-[14px] text-[#6b7a8d] mt-1">for {selectedDistrict}</p>
        </div>
        
        {/* District selector dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDistrictMenu(!showDistrictMenu)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e2e8f0] bg-white hover:bg-[#f0f4f8] transition-colors"
          >
            <span className="text-[13px] font-medium text-[#1a2332]">{selectedDistrict}</span>
            <ChevronDown className="h-4 w-4 text-[#6b7a8d]" />
          </button>

          {showDistrictMenu && (
            <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-lg bg-white border border-[#e2e8f0] shadow-lg max-h-64 overflow-y-auto">
              {["Lilongwe", "Blantyre", "Dedza", "Zomba", "Mchinji", "Kasungu", "Mangochi", "Salima", "Nkhotakota"].map((district) => (
                <button
                  key={district}
                  onClick={() => handleDistrictChange(district)}
                  className={`w-full px-4 py-2 text-left text-[13px] hover:bg-[#f0f4f8] transition-colors ${
                    selectedDistrict === district ? "bg-[#E9F5EC] font-semibold text-[#1F7A63]" : "text-[#1a2332]"
                  }`}
                >
                  {district}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Info banner ──────────────────────────────────────────────────── */}
      <div
        className="px-5 py-4"
        style={{
          background:  "#DFF5E3",
          borderLeft:  "4px solid #2E8B57",
          borderRadius: "4px",
        }}
      >
        <p className="text-[15px] font-medium leading-relaxed" style={{ color: "#1B5E20" }}>
          Rainfall: <strong>{districtData.rainfall.totalMM}mm</strong> | 
          Temperature: <strong>{districtData.temperature.current}°C</strong> | 
          Soil Moisture: <strong>{districtData.soilMoisture.level}%</strong>
        </p>
        <p className="text-[14px] font-medium leading-relaxed mt-2" style={{ color: "#1B5E20" }}>
          This shows when rains usually start in {selectedDistrict}. Use this data to plan your planting season effectively.
        </p>
      </div>

      {/* ── Seasonal Timeline card ────────────────────────────────────────── */}
      <div
        className="rounded-2xl bg-white px-7 pt-6 pb-2"
        style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-[20px] font-bold" style={{ color: "#0F2A3D" }}>
              Seasonal Timeline
            </h2>
            <p className="text-[13px] mt-0.5" style={{ color: "#6b7a8d" }}>
              {districtData.location.region} {districtData.location.zone}
            </p>
          </div>
          <div className="text-right">
            <span
              className="text-[10px] font-bold uppercase tracking-widest block"
              style={{ color: "#1F7A63" }}
            >
              Optimal Window
            </span>
            <span
              className="text-[18px] font-extrabold block mt-0.5"
              style={{ color: "#0F2A3D" }}
            >
              {optimalStart} — {optimalEnd}
            </span>
          </div>
        </div>

        {/* Animated timeline */}
        <TimelineBar markers={markers} />
      </div>

      {/* ── Info cards (3-col) ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-5">
        {INFO_CARDS.map(({ icon: Icon, color, bg, title, body }) => (
          <div
            key={title}
            className="rounded-xl bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{ boxShadow: "0 1px 8px -2px rgba(15,42,61,0.07), 0 0 0 1px #e2e8f0" }}
          >
            {/* Icon + title */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: bg }}
              >
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <h3 className="text-[14px] font-bold" style={{ color }}>
                {title}
              </h3>
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: "#6b7a8d" }}>
              {body}
            </p>
          </div>
        ))}
      </div>

      {/* ── Bottom image card ────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl group cursor-pointer"
        style={{ height: "220px" }}
      >
        <Image
          src="/satellite_farmland.png"
          alt={`${selectedDistrict} Agricultural Zone — satellite view`}
          fill
          className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
        />
        {/* dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        {/* Labels */}
        <div className="absolute bottom-0 left-0 p-6">
          <span
            className="mb-2 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
            style={{ background: "#1F7A63" }}
          >
            Regional Context
          </span>
          <h3 className="text-[22px] font-extrabold text-white mt-1">
            {selectedDistrict} {districtData.location.zone}
          </h3>
        </div>
      </div>

    </div>
  )
}

