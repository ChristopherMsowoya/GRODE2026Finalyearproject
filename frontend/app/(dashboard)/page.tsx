"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  AlertTriangle,
  BarChart3,
  CloudRain,
  Loader2,
  RefreshCcw,
  Sprout,
} from "lucide-react"

import {
  type AlgorithmSummary,
  fetchAlgorithmSummary,
  invalidateAlgorithmCaches,
  triggerPipelineRun,
} from "@/lib/algorithm-api"

function percentage(value: number) {
  return `${Math.round(value * 100)}%`
}

function riskTone(riskLevel: "Low" | "Medium" | "High") {
  if (riskLevel === "High") {
    return {
      accent: "#D64545",
      badge: "High Risk",
      title: "Plant with extreme caution.",
      description:
        "The latest algorithm output shows a strong risk of post-onset dry spells in many Malawi grid cells.",
    }
  }

  if (riskLevel === "Medium") {
    return {
      accent: "#F4A261",
      badge: "Medium Risk",
      title: "Planting conditions are mixed.",
      description:
        "Some areas are stable, but several grid cells still show notable false-onset or crop-stress risk.",
    }
  }

  return {
    accent: "#1F7A63",
    badge: "Low Risk",
    title: "Conditions are relatively stable.",
    description:
      "The current analysis suggests lower rainfall-related planting risk across most analyzed grid cells.",
  }
}

function dominantRisk(summary: AlgorithmSummary): "Low" | "Medium" | "High" {
  const ordered: Array<"Low" | "Medium" | "High"> = ["Low", "Medium", "High"]

  return ordered.reduce((current, next) =>
    summary.risk_counts[next] > summary.risk_counts[current] ? next : current
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-64 animate-pulse rounded-2xl bg-[#dfe7ee]" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="h-52 animate-pulse rounded-2xl bg-[#e8eef3]" />
        <div className="h-52 animate-pulse rounded-2xl bg-[#e8eef3]" />
        <div className="h-52 animate-pulse rounded-2xl bg-[#e8eef3]" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="h-80 animate-pulse rounded-2xl bg-[#e8eef3]" />
        <div className="h-80 animate-pulse rounded-2xl bg-[#e8eef3]" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<AlgorithmSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = async () => {
    setError(null)

    try {
      const nextSummary = await fetchAlgorithmSummary()
      setSummary(nextSummary)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load algorithm data.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadSummary()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)

    try {
      await triggerPipelineRun("malawi")
      invalidateAlgorithmCaches()
      await loadSummary()
    } catch (refreshError) {
      setRefreshing(false)
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh pipeline data.")
    }
  }

  const derived = useMemo(() => {
    if (!summary) {
      return null
    }

    const riskLevel = dominantRisk(summary)
    const tone = riskTone(riskLevel)

    return {
      tone,
      higherRiskAreas: summary.risk_counts.Medium + summary.risk_counts.High,
    }
  }, [summary])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (!summary || !derived) {
    return (
      <div className="rounded-2xl bg-white p-8" style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08)" }}>
        <div className="flex items-start gap-4">
          <AlertTriangle className="mt-1 h-6 w-6 text-[#D64545]" />
          <div>
            <h1 className="text-2xl font-bold text-[#0F2A3D]">Algorithm data is unavailable</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#6b7a8d]">
              {error || "The dashboard could not load the latest rainfall-risk outputs."}
            </p>
            <button
              onClick={handleRefresh}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0F2A3D] px-5 py-3 text-sm font-bold text-white"
            >
              <RefreshCcw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-full">
      <div className="relative overflow-hidden rounded-2xl" style={{ minHeight: "280px" }}>
        <Image
          src="/farmland_hero.png"
          alt="Farmland rows"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 hero-gradient" />

        <div className="relative z-10 flex h-full flex-col justify-between gap-6 p-6 md:p-8" style={{ minHeight: "280px" }}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl space-y-4">
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{
                  background: `${derived.tone.accent}30`,
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.25)",
                }}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: derived.tone.accent }} />
                {derived.tone.badge}
              </span>

              <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
                {derived.tone.title}
              </h1>

              <p className="max-w-xl text-[15px] leading-relaxed text-white/85">
                {derived.tone.description}
              </p>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 self-start rounded-xl px-4 py-3 text-[13px] font-bold text-white transition hover:bg-white/10 disabled:opacity-70"
              style={{ border: "1px solid rgba(255,255,255,0.3)", backdropFilter: "blur(8px)" }}
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh from Algorithm
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/12 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">Grid cells analyzed</p>
              <p className="mt-2 text-3xl font-black text-white">{summary.result_count}</p>
            </div>
            <div className="rounded-2xl bg-white/12 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">Seasons analyzed</p>
              <p className="mt-2 text-3xl font-black text-white">{summary.seasons_analyzed}</p>
            </div>
            <div className="rounded-2xl bg-white/12 p-4 backdrop-blur-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">Areas needing caution</p>
              <p className="mt-2 text-3xl font-black text-white">{derived.higherRiskAreas}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#f4c7c7] bg-[#fff6f6] px-5 py-4 text-[14px] text-[#8a3030]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div
          className="rounded-2xl bg-white p-6"
          style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px rgba(226,232,240,0.8)" }}
        >
          <div className="mb-5 flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#6b7a8d]">Average False-Onset Risk</span>
            <AlertTriangle className="h-5 w-5 text-[#D64545]" />
          </div>
          <h2 className="text-[42px] font-black leading-none tracking-tight text-[#D64545]">
            {percentage(summary.average_false_onset_probability)}
          </h2>
          <p className="mt-4 text-[13px] leading-[1.6] text-[#6b7a8d]">
            Average share of analyzed seasons where onset was followed by a long dry spell.
          </p>
        </div>

        <div
          className="rounded-2xl bg-white p-6"
          style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px rgba(226,232,240,0.8)" }}
        >
          <div className="mb-5 flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#6b7a8d]">Average Crop Stress Risk</span>
            <Sprout className="h-5 w-5 text-[#F4A261]" />
          </div>
          <h2 className="text-[42px] font-black leading-none tracking-tight text-[#0F2A3D]">
            {percentage(summary.average_crop_stress_probability)}
          </h2>
          <p className="mt-4 text-[13px] leading-[1.6] text-[#6b7a8d]">
            Average share of analyzed seasons with a post-onset dry spell strong enough to stress crops.
          </p>
        </div>

        <div
          className="rounded-2xl bg-white p-6"
          style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px rgba(226,232,240,0.8)" }}
        >
          <div className="mb-5 flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#6b7a8d]">Risk Distribution</span>
            <BarChart3 className="h-5 w-5 text-[#0F2A3D]" />
          </div>
          <div className="space-y-3">
            {([
              ["Low", summary.risk_counts.Low, "#1F7A63"],
              ["Medium", summary.risk_counts.Medium, "#D97706"],
              ["High", summary.risk_counts.High, "#D64545"],
            ] as const).map(([label, count, color]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-[#0F2A3D]">{label}</span>
                  <span className="text-[#6b7a8d]">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-[#eef2f4]">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${summary.result_count ? (count / summary.result_count) * 100 : 0}%`,
                      background: color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div
          className="rounded-2xl bg-white p-6"
          style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px rgba(226,232,240,0.8)" }}
        >
          <div>
            <h2 className="text-[24px] font-extrabold text-[#0F2A3D]">What Farmers Should Focus On</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#6b7a8d]">
              Use the map and the district pages to check whether your area has low, medium, or high planting risk before acting on the first rains.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-[#f7fafc] p-5">
              <h3 className="text-[18px] font-bold text-[#0F2A3D]">Onset Information</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[#6b7a8d]">
                Check when onset is usually detected in your district or T/A, then confirm that more rain follows before planting.
              </p>
              <Link href="/onset" className="mt-5 inline-flex rounded-xl bg-[#0F2A3D] px-4 py-3 text-[13px] font-bold text-white">
                View Onset Info
              </Link>
            </div>
            <div className="rounded-2xl bg-[#f7fafc] p-5">
              <h3 className="text-[18px] font-bold text-[#0F2A3D]">District Risk Map</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[#6b7a8d]">
                Open the map to compare districts, then move to false-onset or crop-stress pages for a more specific risk explanation.
              </p>
              <Link href="/map" className="mt-5 inline-flex rounded-xl bg-[#0F2A3D] px-4 py-3 text-[13px] font-bold text-white">
                Open Map
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div
            className="overflow-hidden rounded-2xl bg-white"
            style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px rgba(226,232,240,0.8)" }}
          >
            <div className="relative h-56">
              <Image src="/crop_stress_map.png" alt="Crop stress illustration" fill sizes="(max-width: 1280px) 100vw, 33vw" className="object-cover" />
            </div>
            <div className="p-6">
              <h3 className="text-[22px] font-extrabold text-[#0F2A3D]">Data-Driven Farming Guidance</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[#6b7a8d]">
                These pages now update from the rainfall algorithm, so district and T/A information stays consistent after each refresh.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/false-onset"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0F2A3D] px-5 py-3 text-[13px] font-bold text-white"
                >
                  <CloudRain className="h-4 w-4" />
                  False Onset View
                </Link>
                <Link
                  href="/crop-stress"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#d7dde5] px-5 py-3 text-[13px] font-semibold text-[#0F2A3D]"
                >
                  <Sprout className="h-4 w-4" />
                  Crop Stress View
                </Link>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl bg-white p-6"
            style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px rgba(226,232,240,0.8)" }}
          >
            <h3 className="text-[18px] font-extrabold text-[#0F2A3D]">How to read this dashboard</h3>
            <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-[#6b7a8d]">
              <p>High means the algorithm sees stronger rainfall-related planting risk in more analyzed areas.</p>
              <p>False-onset risk means early rain may be followed by a longer dry spell.</p>
              <p>Crop-stress risk means young crops may suffer after planting because the rain pattern weakens.</p>
              <p>For local decisions, move from the dashboard to the district map, then to district or T/A pages.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
