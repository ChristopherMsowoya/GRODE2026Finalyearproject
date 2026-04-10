"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Droplets, Loader2, MapPin, RefreshCcw, X } from "lucide-react"

import {
  fetchDistrictSummary,
  fetchTraditionalAuthoritySummary,
  invalidateAlgorithmCaches,
  triggerPipelineRun,
  type DistrictSummary,
  type TraditionalAuthoritySummary,
} from "@/lib/algorithm-api"
import { useUser } from "@/lib/user-context"

const DynamicMapComponent = dynamic(() => import("./crop-stress-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-[20px] bg-[#eef2f4]">
      <p className="text-[#6b7a8d]">Loading map...</p>
    </div>
  ),
})

interface InfoCardProps {
  title: string
  value: string | number
  unit?: string
  description: string
  icon: React.ReactNode
}

function InfoCard({ title, value, unit, description, icon }: InfoCardProps) {
  return (
    <div className="flex min-h-[200px] flex-col justify-between rounded-[20px] border border-[#e9edf1] bg-white p-6 shadow-sm">
      <div>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-[14px] font-semibold uppercase tracking-[0.24em] text-[#6b7a8d]">{title}</h3>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f0f4f8]">{icon}</div>
        </div>
        <p className="mb-3 text-[32px] font-bold text-[#0d2f3f]">{value}{unit && <span className="text-[18px] font-semibold text-[#6b7a8d]">{unit}</span>}</p>
      </div>
      <p className="text-[13px] leading-relaxed text-[#6b7a8d]">{description}</p>
    </div>
  )
}

function normalizeUserDistrict(value: string | null | undefined, districts: DistrictSummary[]) {
  if (!value) return districts[0]?.district ?? null
  const match = districts.find((district) => district.district.toLowerCase() === value.toLowerCase())
  return match?.district ?? districts[0]?.district ?? null
}

function riskLabel(probability: number) {
  if (probability > 0.6) return { label: "High", color: "#e06060" }
  if (probability > 0.3) return { label: "Medium", color: "#f3b34c" }
  return { label: "Low", color: "#8fcf9e" }
}

export default function CropStressPage() {
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
      setError(loadError instanceof Error ? loadError.message : "Unable to load crop-stress data.")
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
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh crop-stress data.")
    }
  }

  const cropStressProbability = activeSummary?.average_crop_stress_probability ?? 0
  const risk = riskLabel(cropStressProbability)
  return (
    <div className="space-y-6 bg-[#eef2f4] px-0 pb-6">
      <div className="rounded-[20px] border border-[#e9edf1] bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-[0.32em] text-[#6b7a8d]">Crop Stress Analysis</p>
            <h1 className="text-4xl font-bold text-[#0d2f3f]">Crop Stress Risk</h1>
            <p className="max-w-2xl text-sm leading-6 text-[#6b7a8d]">
              Drill from district down to Traditional Authority to inspect crop-stress risk at a narrower level.
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
                <div className="absolute top-full left-0 z-50 mt-2 w-80 rounded-[12px] border border-[#e2e8f0] bg-white shadow-lg">
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
                <div className="absolute top-full left-0 z-50 mt-2 w-80 rounded-[12px] border border-[#e2e8f0] bg-white shadow-lg">
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

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded-[20px] border border-[#e9edf1] bg-white p-0 shadow-sm" style={{ minHeight: "600px" }}>
          <DynamicMapComponent
            selectedDistrict={selectedDistrictSummary?.district ?? null}
            selectedTA={selectedTA}
            onSelectDistrict={(district) => { setSelectedDistrict(district); setSelectedTA(null) }}
            onSelectTA={setSelectedTA}
            districtSummaries={districtSummaries}
            taSummaries={taSummaries}
          />
        </div>

        <div className="flex flex-col gap-5">
          <InfoCard title="Crop Stress" value={Math.round(cropStressProbability * 100)} unit="%" description={`Average crop-stress probability for ${selectedTASummary?.traditional_authority || selectedDistrictSummary?.district || "selected area"}.`} icon={<Droplets className="h-5 w-5 text-[#0987a6]" />} />
          <InfoCard title="Onset Seen" value={Math.round((activeSummary?.onset_detection_rate ?? 0) * 100)} unit="%" description="Share of analyzed seasons where onset was detected in the selected area." icon={<Droplets className="h-5 w-5 text-[#1F7A63]" />} />
          <InfoCard title="Seasons Analyzed" value={activeSummary?.seasons_analyzed ?? 0} description="Number of seasons contributing to this crop-stress summary." icon={<Droplets className="h-5 w-5 text-[#d97706]" />} />
        </div>
      </div>

      {loading && <div className="rounded-2xl bg-white px-5 py-4 text-sm text-[#6b7a8d]">Loading live crop-stress summaries...</div>}
    </div>
  )
}
