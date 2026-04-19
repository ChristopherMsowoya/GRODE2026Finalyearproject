"use client"

import { AlertTriangle, Info, HelpCircle, Tractor, ChevronLeft, ChevronRight, Wifi } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useUser } from "@/lib/user-context"
import { fetchDistrictSummary, type DistrictSummary } from "@/lib/algorithm-api"

function SunRingIcon() {
  return (
    <svg viewBox="0 0 56 56" fill="none" className="h-14 w-14">
      <circle cx="28" cy="28" r="10" stroke="#0F2A3D" strokeWidth="2.5" />
      {/* Rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180
        const x1 = 28 + 14 * Math.cos(rad)
        const y1 = 28 + 14 * Math.sin(rad)
        const x2 = 28 + 19 * Math.cos(rad)
        const y2 = 28 + 19 * Math.sin(rad)
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0F2A3D" strokeWidth="2" strokeLinecap="round" />
        )
      })}
    </svg>
  )
}

// ─── Guidance Slideshow ─────────────────────────────────────────────────────
function GuidanceSlideshow() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const slides = [
    {
      title: "Waiting for True Onset",
      description: "Wait for consistent rainfall patterns (25mm over 3 days) before planting",
      prompt: "Agricultural scene showing a farmer waiting during early scattered rains with lush green fields, professional farming photography style",
      color: "#1F7A63",
      id: "onset"
    },
    {
      title: "Soil Moisture Verification",
      description: "Ensure soil moisture exceeds 60% in the top 30cm before sowing",
      prompt: "Farmer using a soil moisture meter in a maize field, checking soil moisture levels before planting, professional agricultural photography style",
      color: "#0F2A3D",
      id: "soil"
    },
    {
      title: "Crop Health Monitoring",
      description: "Monitor early seedlings for stress signals during the first 3 weeks",
      prompt: "Close-up of maize seedlings showing healthy green leaves and strong root development in fertile soil, agricultural science photography",
      color: "#F4A261",
      id: "crop"
    },
  ]

  useEffect(() => {
    const generateImages = async () => {
      setLoading(true)
      const generated: Record<string, string> = {}

      for (const slide of slides) {
        try {
          const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: slide.prompt })
          })

          if (response.ok) {
            const data = await response.json()
            generated[slide.id] = data.image
          } else {
            // Fallback to placeholder if generation fails
            generated[slide.id] = `https://images.unsplash.com/photo-${slide.id === 'soil' ? '1500382017468-7049fae79eef' : slide.id === 'crop' ? '1625246333195-78d9c38ad576' : '1574943320219-553eb213f72d'}?w=600&h=400&fit=crop`
          }
        } catch (error) {
          console.error(`Failed to generate image for ${slide.id}:`, error)
          // Use Unsplash fallback
          generated[slide.id] = `https://images.unsplash.com/photo-${slide.id === 'soil' ? '1500382017468-7049fae79eef' : slide.id === 'crop' ? '1625246333195-78d9c38ad576' : '1574943320219-553eb213f72d'}?w=600&h=400&fit=crop`
        }
      }

      setGeneratedImages(generated)
      setLoading(false)
    }

    generateImages()
  }, [])

  const nextSlide = () => setCurrentSlide((p) => (p + 1) % slides.length)
  const prevSlide = () => setCurrentSlide((p) => (p - 1 + slides.length) % slides.length)

  const slide = slides[currentSlide]
  const imageUrl = generatedImages[slide.id] || `https://images.unsplash.com/photo-${slide.id === 'soil' ? '1500382017468-7049fae79eef' : slide.id === 'crop' ? '1625246333195-78d9c38ad576' : '1574943320219-553eb213f72d'}?w=600&h=400&fit=crop`

  return (
    <div className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Image */}
        <div className="relative h-64 md:h-auto overflow-hidden bg-[#f0f4f8]">
          {loading && currentSlide > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#f0f4f8" }}>
              <div className="text-center">
                <div className="h-8 w-8 border-4 rounded-full animate-spin mb-2" style={{ borderColor: "#e2e8f0", borderTopColor: "#1F7A63" }} />
                <p className="text-[12px] text-[#6b7a8d]">Generating image...</p>
              </div>
            </div>
          ) : (
            <>
              <Image
                src={imageUrl}
                alt={slide.title}
                fill
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
            </>
          )}
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 flex flex-col justify-between">
          <div>
            <span
              className="inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest mb-3"
              style={{ color: slide.color, background: `${slide.color}15` }}
            >
              Guidance Tip
            </span>
            <h3 className="text-[22px] font-extrabold leading-tight mb-3" style={{ color: "#0F2A3D" }}>
              {slide.title}
            </h3>
            <p className="text-[14px] leading-relaxed text-[#6b7a8d] mb-6">
              {slide.description}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className="h-2 rounded-full transition-all duration-200"
                  style={{
                    width: currentSlide === i ? "24px" : "8px",
                    background: currentSlide === i ? slide.color : "#e2e8f0"
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={prevSlide}
                className="flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:bg-[#f0f4f8]"
                style={{ borderColor: "#e2e8f0", color: "#6b7a8d" }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={nextSlide}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:bg-[#f0f4f8]"
                style={{ background: slide.color, color: "white" }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useUser()
  const [liveDistrictData, setLiveDistrictData] = useState<DistrictSummary[]>([])
  const [liveStatus, setLiveStatus] = useState<"loading" | "live" | "error">("loading")

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const res = await fetchDistrictSummary()
        if (cancelled) return
        if ((res as any).pipeline_status === "not_run") {
          setLiveStatus("error")
          return
        }
        setLiveDistrictData(res.districts)
        setLiveStatus("live")
      } catch {
        if (!cancelled) setLiveStatus("error")
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [])

  const formatDistrict = (d?: string) => d ? d.charAt(0).toUpperCase() + d.slice(1).toLowerCase() : "Lilongwe"
  const defaultDistrict = formatDistrict(user?.district)
  const districtRiskData = liveDistrictData.find(d => d.district === defaultDistrict)

  const foProb = districtRiskData ? (districtRiskData.overall_risk_probability || 0) : 0.90
  const foLevel = foProb > 0.6 ? "HIGH" : foProb > 0.3 ? "MED" : "LOW"
  const foColor = foProb > 0.6 ? "#D64545" : foProb > 0.3 ? "#F4A261" : "#1F7A63"
  const foPercent = (foProb * 100).toFixed(0) + "%"

  let foMessage = `There is an elevated ${foPercent} probability that initial rains will be followed by at least a 10-day dry spell, which is highly destructive to seedlings.`
  if (foLevel === "LOW") {
    foMessage = `With a minimal probability (${foPercent}) of prolonged dry spells, the rains are predicted to be consistent enough to support healthy seedling emergence.`
  } else if (foLevel === "MED") {
    foMessage = `There is a moderate ${foPercent} probability of intermittent dry spells. Farmers should ensure resilient crop varieties or supplementary water availability.`
  }

  const csProb = districtRiskData ? (districtRiskData.average_crop_stress_probability || 0) : 0.45
  const csLevel = csProb > 0.6 ? "HIGH" : csProb > 0.3 ? "MED" : "LOW"
  const csColor = csProb > 0.6 ? "#D64545" : csProb > 0.3 ? "#F4A261" : "#1F7A63"

  // Dynamic Banner Logic
  let bannerTitle = "Wait before planting."
  let bannerMessage = "Current indicators suggest high risk of false-onset rains. Planting now may result in total crop loss during the upcoming dry spell."
  let bannerTheme = {
    badgeBg: "rgba(244,162,97,0.22)", badgeColor: "#F4A261",
    iconBg: "rgba(214,69,69,0.22)", iconBorder: "rgba(214,69,69,0.4)"
  }

  if (foLevel === "MED") {
    bannerTitle = "Proceed with Caution."
    bannerMessage = "There is a moderate risk of false-onset rains. Ensure you have access to supplementary water if dry spells occur."
    bannerTheme = {
      badgeBg: "rgba(244,162,97,0.22)", badgeColor: "#F4A261",
      iconBg: "rgba(244,162,97,0.22)", iconBorder: "rgba(244,162,97,0.4)"
    }
  } else if (foLevel === "LOW") {
    bannerTitle = "Favorable Planting Conditions."
    bannerMessage = "Algorithm indicators show low risk of false-onset rains. Planting is currently recommended following optimal soil moisture."
    bannerTheme = {
      badgeBg: "rgba(31,122,99,0.22)", badgeColor: "#1F7A63",
      iconBg: "rgba(31,122,99,0.22)", iconBorder: "rgba(31,122,99,0.4)"
    }
  }

  return (
    <div className="space-y-6 max-w-full">

      {/* ─── Hero Alert Banner ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl" style={{ minHeight: "260px" }}>
        {/* Background Image */}
        <Image
          src="/farmland_hero.png"
          alt="Farmland rows"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 hero-gradient" />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col md:flex-row items-start md:items-center justify-between p-5 md:p-8 space-y-6 md:space-y-0" style={{ minHeight: "260px" }}>
          <div className="space-y-4 max-w-lg">
            {/* Badge */}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest"
              style={{ background: bannerTheme.badgeBg, color: bannerTheme.badgeColor, border: `1px solid ${bannerTheme.badgeColor}66` }}
            >
              <span className="h-1.5 w-1.5 rounded-full pulse-dot inline-block" style={{ backgroundColor: bannerTheme.badgeColor }} />
              Urgent Guidance
            </span>

            <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight drop-shadow-md">
              {bannerTitle}
            </h1>
            <p className="text-[15px] text-white/80 leading-relaxed font-medium max-w-xl">
              {bannerMessage}
            </p>
          </div>

          {/* Warning Icon */}
          <div
            className="hidden sm:flex h-[88px] w-[88px] flex-shrink-0 items-center justify-center rounded-full md:ml-8"
            style={{ background: bannerTheme.iconBg, border: `1px solid ${bannerTheme.iconBorder}`, backdropFilter: "blur(8px)" }}
          >
            <AlertTriangle className="h-11 w-11" style={{ color: bannerTheme.badgeColor }} />
          </div>
        </div>
      </div>

      {/* ─── API Statistics Layout ─────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-[13px] text-[#6b7a8d] font-medium px-1">
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${liveStatus === "live" ? "bg-[#1F7A63] animate-pulse" : "bg-[#6b7a8d]"}`} />
          <span>{liveStatus === "live" ? "Algorithms Live" : "Analyzing Models..."}</span>
        </div>
        <span className="opacity-40">|</span>
        <span>
          <strong className="text-[#0F2A3D]">{districtRiskData?.grid_cell_count || 128}</strong> Grids Analyzed
        </span>
        <span className="opacity-40">|</span>
        <span>
          <strong className="text-[#0F2A3D]">{districtRiskData?.seasons_analyzed || 40}</strong> Seasons Validated
        </span>
      </div>

      {/* ─── Metric Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Onset Status */}
        <div
          className="card-hover group rounded-2xl bg-white p-6"
          style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px rgba(226,232,240,0.8)" }}
        >
          <div className="mb-5 flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#6b7a8d]">
              Onset Status ({defaultDistrict})
            </span>
            <button className="rounded-full p-1 text-[#6b7a8d] transition-colors hover:text-[#0F2A3D] hover:bg-[#f0f4f8]">
              <Info className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col items-center space-y-4">
            {/* Sun ring icon */}
            <div
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full transition-all duration-300 group-hover:scale-105"
              style={{ background: "#f0f4f8" }}
            >
              <SunRingIcon />
            </div>

            {/* Status badge */}
            <span
              className="inline-block rounded-full px-4 py-1.5 text-[13px] font-bold"
              style={{ color: "#D64545", background: "rgba(214,69,69,0.08)", border: "1.5px solid rgba(214,69,69,0.25)" }}
            >
              Not Started
            </span>

            <p className="text-center text-[13px] leading-[1.6] text-[#6b7a8d]">
              The main rains have not consistently begun. Scattered showers are expected but do
              not signal the season start.
            </p>
          </div>
        </div>

        {/* False-Onset Risk */}
        <div
          className="card-hover rounded-2xl bg-white p-6"
          style={{
            boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px rgba(226,232,240,0.8)",
            borderLeft: `4px solid ${foColor}`,
          }}
        >
          <div className="mb-5 flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#6b7a8d]">
              False-Onset Risk ({defaultDistrict})
            </span>
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-bold text-white bg-opacity-90"
              style={{ background: foColor }}
            >
              !
            </span>
          </div>

          <div className="space-y-4">
            <h2 className="text-[42px] font-black leading-none tracking-tight" style={{ color: foColor }}>
              {foLevel}
            </h2>

            {/* Progress bar */}
            <div>
              <div className="mb-1.5 flex justify-between items-center">
                <span className="text-[11px] text-[#6b7a8d]">Risk level</span>
                <span className="text-[11px] font-bold" style={{ color: foColor }}>{foPercent}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#f0f4f8]">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-in-out"
                  style={{
                    width: foPercent,
                    background: foColor,
                    boxShadow: `0 0 8px ${foColor}80`
                  }}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-1.5 text-[13px] font-bold text-[#1a2332]">What this means</h3>
              <p className="text-[13px] leading-[1.6] text-[#6b7a8d]">
                {foMessage}
              </p>
            </div>
          </div>
        </div>

        {/* Crop Stress Risk */}
        <div
          className="card-hover rounded-2xl bg-white p-6"
          style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px rgba(226,232,240,0.8)", borderLeft: `4px solid ${csColor}` }}
        >
          <div className="mb-5 flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#6b7a8d]">
              Crop Stress Risk ({defaultDistrict})
            </span>
            <button className="rounded-full p-1 text-[#6b7a8d] transition-colors hover:text-[#0F2A3D] hover:bg-[#f0f4f8]">
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-[42px] font-black leading-none tracking-tight" style={{ color: csColor }}>
                {csLevel}
              </h2>
              <span
                className="mt-1 inline-block text-[11.5px] font-bold uppercase tracking-wide"
                style={{ color: csColor }}
              >
                {csLevel === "HIGH" ? "↑ SEVERE" : csLevel === "MED" ? "↑ INCREASING" : "↓ LOW"}
              </span>
            </div>
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ background: `${csColor}15` }}
            >
              <Tractor className="h-7 w-7" style={{ color: csColor }} />
            </div>
          </div>

          <div>
            <h3 className="mb-1.5 text-[13px] font-bold text-[#1a2332]">What this means</h3>
            <p className="text-[13px] leading-[1.6] text-[#6b7a8d]">
              {csLevel === "HIGH" ? "Critical soil temperatures and low moisture." : csLevel === "MED" ? "Rising soil temperatures and low moisture levels." : "Favorable conditions for early crop stages."}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Lower Section ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Regional Soil Moisture */}
        <div className="relative h-64 overflow-hidden rounded-2xl group cursor-pointer" style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.12)" }}>
          <Image
            src="/soil_moisture.png"
            alt="Regional Soil Moisture - Lilongwe central plains"
            fill
            className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
          />
          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h3 className="text-[16px] font-bold text-white">Regional Soil Moisture</h3>
            <p className="mt-0.5 text-[12.5px] text-white/70">
              Real-time satellite tracking of {defaultDistrict}
            </p>
          </div>
        </div>

        {/* Evidence-Based Farming */}
        <div className="flex flex-col justify-center px-2 py-4 space-y-4">
          <div>
            <h2 className="text-[26px] font-extrabold leading-tight tracking-tight" style={{ color: "#0F2A3D" }}>
              Evidence-Based Farming
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-[#6b7a8d]">
              Combines historical weather patterns with real-time satellite telemetry to provide
              Malawi&#39;s farmers with actionable insights. By delaying planting until a true onset
              is confirmed, you protect your investment and ensure national food security.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Link
              href="/map/full"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[13.5px] font-bold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95"
              style={{ background: "linear-gradient(135deg, #0F2A3D 0%, #1a3d54 100%)" }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              </svg>
              View Full Map
            </Link>
            <Link
              href="/details"
              className="inline-flex items-center gap-2 rounded-xl border border-[#e2e8f0] px-6 py-3 text-[13.5px] font-semibold text-[#1a2332] transition-all duration-200 hover:bg-[#f0f4f8] hover:border-[#0F2A3D]/30 active:scale-95"
            >
              Details
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Guidance Slideshow ────────────────────────────────────────── */}
      <div>
        <h2 className="text-[24px] font-extrabold mb-4" style={{ color: "#0F2A3D" }}>
          Farming Guidance Tips
        </h2>
        <GuidanceSlideshow />
      </div>

    </div>
  )
}
