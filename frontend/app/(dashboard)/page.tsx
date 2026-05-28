"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Activity, Database, Grid3X3, MapPinned, Radio } from "lucide-react"
import { fetchDashboardOverview, fetchDistrictSummary, type DashboardOverview } from "@/lib/algorithm-api"

function MetricTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Grid3X3
  label: string
  value: string | number
  detail: string
}) {
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-[#eef7f4] text-[#1F7A63]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">{label}</p>
      <p className="mt-2 text-[34px] font-black leading-none text-[#0F2A3D]">{value}</p>
      <p className="mt-2 text-[12px] font-medium leading-relaxed text-[#6b7a8d]">{detail}</p>
    </div>
  )
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [districtCount, setDistrictCount] = useState(0)
  const [liveStatus, setLiveStatus] = useState<"loading" | "live" | "error">("loading")

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      try {
        const [overviewResponse, districtResponse] = await Promise.all([
          fetchDashboardOverview(),
          fetchDistrictSummary(),
        ])
        if (cancelled) return
        setOverview(overviewResponse)
        setDistrictCount(districtResponse.district_count || districtResponse.districts.length)
        setLiveStatus(overviewResponse.grid_count > 0 ? "live" : "error")
      } catch {
        if (!cancelled) setLiveStatus("error")
      }
    }

    void loadDashboard()
    return () => {
      cancelled = true
    }
  }, [])

  const seasonLabel = useMemo(() => {
    const years = overview?.available_years || []
    if (!years.length) return "No seasons loaded"
    return `${years[0]}-${years[years.length - 1]} rainfall seasons`
  }, [overview])

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="flex min-h-[360px] flex-col justify-between rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-sm md:p-8">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#166534]">
              <Radio className="h-3.5 w-3.5" />
              ACTIVE ALGORITHM LIVE
            </div>
            <h1 className="max-w-2xl text-[34px] font-black leading-tight text-[#0F2A3D] md:text-[44px]">
              Grid-Level Rainfall Onset Detection Engine (GRODE)
            </h1>
            <p className="mt-4 max-w-xl text-[15px] font-medium leading-relaxed text-[#607086]">
              Scientific climate intelligence for Malawi built from CHIRPS rainfall diagnostics,
              5km grid cells, and grid-level onset, false-onset, and dry-spell outputs.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/onset"
              className="inline-flex items-center gap-2 rounded-md bg-[#0F2A3D] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#17384f]"
            >
              <Activity className="h-4 w-4" />
              Open Onset Analytics
            </Link>
            <Link
              href="/map"
              className="inline-flex items-center gap-2 rounded-md border border-[#d6dee8] bg-white px-4 py-2.5 text-[13px] font-bold text-[#0F2A3D] transition hover:bg-[#f8fafc]"
            >
              <MapPinned className="h-4 w-4" />
              View Grid Map
            </Link>
          </div>
        </div>

        <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-[#d6dee8] bg-[#0F2A3D] shadow-sm">
          <Image src="/malawi_terrain.png" alt="Malawi terrain climate visualization" fill className="object-cover opacity-80" priority />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,42,61,0.94),rgba(15,42,61,0.54),rgba(15,42,61,0.22))]" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ee8ce]">Climate Intelligence</p>
            <h2 className="mt-2 max-w-sm text-[32px] font-black leading-tight text-white">
              Save Malawi with Climate Intelligence
            </h2>
            <p className="mt-3 max-w-md text-[13px] font-medium leading-relaxed text-white/78">
              Every diagnostic stays tied to the grid cell where the rainfall signal is measured.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricTile
          icon={Grid3X3}
          label="Total Grid Cells Analyzed"
          value={overview?.grid_count ?? "..."}
          detail="Loaded grid-level rainfall diagnostic cells."
        />
        <MetricTile
          icon={MapPinned}
          label="Total Districts Covered"
          value={districtCount || "..."}
          detail="District coverage from real Malawi boundary intersections."
        />
        <MetricTile
          icon={Database}
          label="Total Seasons Analyzed"
          value={overview?.season_count ?? "..."}
          detail={seasonLabel}
        />
      </section>

      {/* <section className="rounded-lg border border-[#e2e8f0] bg-white p-5 shadow-sm"> 
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">System State</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1.5 text-[12px] font-bold text-[#166534]">
            <span className={`h-2 w-2 rounded-full ${liveStatus === "live" ? "animate-pulse bg-[#22c55e]" : "bg-[#94a3b8]"}`} />
            ACTIVE ALGORITHM LIVE
          </div>
        </div>
      </section>*/}
    </div>
  )
}
