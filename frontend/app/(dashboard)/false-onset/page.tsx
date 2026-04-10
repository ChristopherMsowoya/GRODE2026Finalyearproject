"use client"

import { useEffect, useMemo, useState } from "react"
import { CloudRain, Info, Loader2, MapPin, RefreshCcw, X } from "lucide-react"

import {
  fetchDistrictSummary,
  fetchTraditionalAuthoritySummary,
  invalidateAlgorithmCaches,
  triggerPipelineRun,
  type DistrictSummary,
  type TraditionalAuthoritySummary,
} from "@/lib/algorithm-api"
import { useUser } from "@/lib/user-context"
import FalseOnsetMap from "./false-onset-map"

function riskCategory(probability: number) {
  if (probability > 0.6) return { key: "alert", label: "High", color: "#e36a6a" }
  if (probability > 0.3) return { key: "caution", label: "Medium", color: "#f2b24a" }
  return { key: "optimal", label: "Low", color: "#9fd3a8" }
}

function RiskMeter({ probability }: { probability: number }) {
  const config = riskCategory(probability)
  const left = config.key === "alert" ? "83.33%" : config.key === "caution" ? "50%" : "16.67%"

  return (
    <div className="mt-6">
      <div className="flex justify-between text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
        <span className="text-[#7cc6a4]">LOW</span>
        <span className="text-[#f2b24a]">MEDIUM</span>
        <span className="text-[#e36a6a]">HIGH</span>
      </div>
      <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-[#eef2f4]">
        <div className="absolute inset-y-0 left-0 w-1/3 rounded-l-full bg-[#9fd3a8]" />
        <div className="absolute inset-y-0 left-1/3 w-1/3 bg-[#f2b24a]" />
        <div className="absolute inset-y-0 right-0 w-1/3 rounded-r-full bg-[#e36a6a]" />
        <div className="absolute -top-4 -translate-x-1/2" style={{ left }}>
          <div className="h-0 w-0 border-x-[8px] border-x-transparent border-b-[12px]" style={{ borderBottomColor: config.color }} />
          <div className="mt-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: config.color }}>
            {config.label}
          </div>
        </div>
      </div>
    </div>
  )
}

function normalizeUserDistrict(value: string | null | undefined, districts: DistrictSummary[]) {
  if (!value) return districts[0]?.district ?? null
  const match = districts.find((district) => district.district.toLowerCase() === value.toLowerCase())
  return match?.district ?? districts[0]?.district ?? null
}

export default function FalseOnsetRiskPage() {
  const { user } = useUser()
  const [districtSummaries, setDistrictSummaries] = useState<DistrictSummary[]>([])
  const [taSummaries, setTaSummaries] = useState<TraditionalAuthoritySummary[]>([])
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const [selectedTA, setSelectedTA] = useState<string | null>(null)
  const [showDistrictSelector, setShowDistrictSelector] = useState(false)
  const [showTASelector, setShowTASelector] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSummaries = async () => {
    setError(null)
    try {
      const [districtData, taData] = await Promise.all([
        fetchDistrictSummary(),
        fetchTraditionalAuthoritySummary(),
      ])
      setDistrictSummaries(districtData.districts)
      setTaSummaries(taData.traditional_authorities)
      setSelectedDistrict((current) => current ?? normalizeUserDistrict(user?.district, districtData.districts))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load false-onset data.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadSummaries()
  }, [user?.district])

  const filteredTAs = useMemo(
    () => taSummaries.filter((ta) => ta.district === selectedDistrict),
    [taSummaries, selectedDistrict]
  )

  const selectedDistrictSummary = useMemo(
    () => districtSummaries.find((district) => district.district === selectedDistrict) ?? districtSummaries[0],
    [districtSummaries, selectedDistrict]
  )
  const selectedTASummary = useMemo(
    () => filteredTAs.find((ta) => ta.shape_id === selectedTA) ?? null,
    [filteredTAs, selectedTA]
  )
  const activeSummary = selectedTASummary ?? selectedDistrictSummary

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await triggerPipelineRun("malawi")
      invalidateAlgorithmCaches()
      await loadSummaries()
    } catch (refreshError) {
      setRefreshing(false)
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh false-onset data.")
    }
  }

  const falseOnsetProbability = activeSummary?.average_false_onset_probability ?? 0
  const risk = riskCategory(falseOnsetProbability)

  return (
    <div className="space-y-6 bg-[#eef2f4] px-0 pb-6 md:px-0">
      <div className="rounded-[20px] bg-white p-6 md:p-8 shadow-sm border border-[#e9edf1]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-[0.32em] text-[#6b7a8d]">False-Onset Risk</p>
            <h1 className="text-4xl font-bold text-[#0F2A3D]">False-Onset Risk</h1>
            <p className="max-w-2xl text-sm leading-6 text-[#6b7a8d]">
              Drill from district down to Traditional Authority to inspect a narrower rainfall-risk area using real shapefile boundaries.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-full bg-[#fef3e0] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.24em]" style={{ color: risk.color }}>
              {risk.label} Risk Zone
            </div>
            <button onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-2 rounded-full border border-[#d8dee4] bg-[#f8fafb] px-4 py-3 text-sm font-semibold text-[#0F2A3D] hover:bg-[#f0f2f4]">
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Refresh
            </button>
            <div className="relative">
              <button onClick={() => setShowDistrictSelector((open) => !open)} className="flex items-center gap-3 rounded-full border border-[#d8dee4] bg-[#f8fafb] px-4 py-3 hover:bg-[#f0f2f4] transition-colors">
                <MapPin className="h-4 w-4 text-[#0b3a4a]" />
                <span className="text-sm font-medium text-[#0F2A3D]">{selectedDistrictSummary?.district || "Select District"}</span>
              </button>
              {showDistrictSelector && (
                <div className="absolute top-full left-0 mt-2 w-80 rounded-[12px] border border-[#e2e8f0] bg-white shadow-lg z-50">
                  <div className="flex items-center justify-between border-b border-[#e2e8f0] p-4"><h3 className="text-sm font-semibold text-[#0F2A3D]">Select District</h3><button onClick={() => setShowDistrictSelector(false)} className="text-[#6b7a8d] hover:text-[#0F2A3D]"><X className="h-4 w-4" /></button></div>
                  <div className="max-h-72 overflow-y-auto p-2">
                    {districtSummaries.map((district) => (
                      <button key={district.district} onClick={() => { setSelectedDistrict(district.district); setSelectedTA(null); setShowDistrictSelector(false) }} className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[#f8fafb]">{district.district}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => setShowTASelector((open) => !open)} disabled={!selectedDistrict} className="flex items-center gap-3 rounded-full border border-[#d8dee4] bg-[#f8fafb] px-4 py-3 hover:bg-[#f0f2f4] transition-colors disabled:opacity-50">
                <MapPin className="h-4 w-4 text-[#0b3a4a]" />
                <span className="text-sm font-medium text-[#0F2A3D]">{selectedTASummary?.traditional_authority || "Select T/A"}</span>
              </button>
              {showTASelector && (
                <div className="absolute top-full left-0 mt-2 w-80 rounded-[12px] border border-[#e2e8f0] bg-white shadow-lg z-50">
                  <div className="flex items-center justify-between border-b border-[#e2e8f0] p-4"><h3 className="text-sm font-semibold text-[#0F2A3D]">Select Traditional Authority</h3><button onClick={() => setShowTASelector(false)} className="text-[#6b7a8d] hover:text-[#0F2A3D]"><X className="h-4 w-4" /></button></div>
                  <div className="max-h-72 overflow-y-auto p-2">
                    <button onClick={() => { setSelectedTA(null); setShowTASelector(false) }} className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[#f8fafb]">All T/As in district</button>
                    {filteredTAs.map((ta) => (
                      <button key={ta.shape_id} onClick={() => { setSelectedTA(ta.shape_id ?? null); setShowTASelector(false) }} className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[#f8fafb]">{ta.traditional_authority}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="rounded-2xl bg-[#fff5f5] px-5 py-4 text-sm text-[#8a3030]">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-5">
          <div className="rounded-[20px] bg-white p-7 shadow-sm border border-[#e9edf1]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-[20px] font-bold text-[#0F2A3D]">Current Planting Risk Status</h2>
              <span className="inline-flex rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ background: "#fef3e0", color: risk.color }}>
                {risk.label.toUpperCase()} RISK ZONE
              </span>
            </div>

            <RiskMeter probability={falseOnsetProbability} />

            <div className="mt-7 rounded-[20px] border border-[#f1e6d0] bg-[#fdf8f2] p-5" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff3e0]"><Info className="h-5 w-5 text-[#f0a32e]" /></div>
                <div>
                  <p className="text-[15px] font-semibold text-[#8a4d00]">
                    {risk.key === "alert" ? "High risk of false onset. Avoid immediate planting after first rains." : risk.key === "caution" ? "Moderate false-onset risk. Watch for follow-up rains before planting." : "Low false-onset risk relative to other areas."}
                  </p>
                  <p className="mt-2 text-[13px] leading-6 text-[#6b7a8d]">
                    {selectedTASummary
                      ? `${selectedTASummary.traditional_authority} in ${selectedTASummary.district} has an average false-onset probability of ${Math.round(selectedTASummary.average_false_onset_probability * 100)}% from ${selectedTASummary.grid_cell_count} matched grid cells.`
                      : selectedDistrictSummary
                        ? `${selectedDistrictSummary.district} has an average false-onset probability of ${Math.round(selectedDistrictSummary.average_false_onset_probability * 100)}% based on ${selectedDistrictSummary.grid_cell_count} rainfall grid cells.`
                        : "Select a district to view live false-onset risk."}
                  </p>
                </div>
              </div>
            </div>

          </div>

          <div className="rounded-[20px] bg-white p-0 shadow-sm border border-[#e9edf1] overflow-hidden" style={{ minHeight: "500px" }}>
            <FalseOnsetMap
              selectedDistrict={selectedDistrictSummary?.district ?? null}
              selectedTA={selectedTA}
              onSelectDistrict={(district) => { setSelectedDistrict(district); setSelectedTA(null) }}
              onSelectTA={setSelectedTA}
              districtSummaries={districtSummaries}
              taSummaries={taSummaries}
            />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-[20px] bg-white p-6 shadow-sm border border-[#e9edf1]">
            <div className="flex items-center gap-3"><CloudRain className="h-5 w-5 text-[#0F2A3D]" /><h3 className="text-lg font-bold text-[#0F2A3D]">Selected Area Summary</h3></div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#f8fafb] p-4"><p className="text-xs uppercase tracking-[0.18em] text-[#6b7a8d]">False Onset</p><p className="mt-2 text-2xl font-extrabold text-[#0F2A3D]">{Math.round(falseOnsetProbability * 100)}%</p></div>
              <div className="rounded-2xl bg-[#f8fafb] p-4"><p className="text-xs uppercase tracking-[0.18em] text-[#6b7a8d]">Grid Cells</p><p className="mt-2 text-2xl font-extrabold text-[#0F2A3D]">{activeSummary?.grid_cell_count ?? 0}</p></div>
              <div className="rounded-2xl bg-[#f8fafb] p-4"><p className="text-xs uppercase tracking-[0.18em] text-[#6b7a8d]">Onset Seen</p><p className="mt-2 text-2xl font-extrabold text-[#0F2A3D]">{Math.round((activeSummary?.onset_detection_rate ?? 0) * 100)}%</p></div>
              <div className="rounded-2xl bg-[#f8fafb] p-4"><p className="text-xs uppercase tracking-[0.18em] text-[#6b7a8d]">Seasons</p><p className="mt-2 text-2xl font-extrabold text-[#0F2A3D]">{activeSummary?.seasons_analyzed ?? 0}</p></div>
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="rounded-2xl bg-white px-5 py-4 text-sm text-[#6b7a8d]">Loading live false-onset summaries...</div>}
    </div>
  )
}
