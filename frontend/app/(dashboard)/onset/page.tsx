"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, CloudRain, Loader2, MapPin, RefreshCcw, X } from "lucide-react"

import {
  fetchDistrictSummary,
  fetchTraditionalAuthoritySummary,
  invalidateAlgorithmCaches,
  triggerPipelineRun,
  type DistrictSummary,
  type TraditionalAuthoritySummary,
} from "@/lib/algorithm-api"
import { useUser } from "@/lib/user-context"

function normalizeUserDistrict(value: string | null | undefined, districts: DistrictSummary[]) {
  if (!value) return districts[0]?.district ?? null

  const match = districts.find((district) => district.district.toLowerCase() === value.toLowerCase())
  return match?.district ?? districts[0]?.district ?? null
}

function formatDateLabel(value: string | null) {
  if (!value) return "Not detected"

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function onsetGuidance(summary: DistrictSummary | TraditionalAuthoritySummary | null) {
  if (!summary) {
    return {
      title: "Select an area",
      body: "Choose a district or T/A to see when the rains are usually detected and whether planting looks safer or riskier there.",
      tone: "#0F2A3D",
      background: "#f4f7fa",
    }
  }

  const onsetRate = summary.onset_detection_rate
  const falseOnset = summary.average_false_onset_probability
  const cropStress = summary.average_crop_stress_probability

  if (onsetRate >= 0.6 && falseOnset <= 0.3 && cropStress <= 0.3) {
    return {
      title: "More dependable planting signal",
      body: "Rainfall onset is detected more often here, and follow-up dry-spell risk is relatively low.",
      tone: "#1B5E20",
      background: "#e8f5ea",
    }
  }

  if (falseOnset > 0.3 || cropStress > 0.3) {
    return {
      title: "Plant with caution",
      body: "This area can receive early rain, but follow-up dry spells still appear often enough to delay planting until the rain pattern is steadier.",
      tone: "#8a4d00",
      background: "#fff4df",
    }
  }

  return {
    title: "Watch the next rains closely",
    body: "Onset is sometimes detected here, but not in every analyzed season. It is safer to confirm that the first rain is followed by more rain before planting widely.",
    tone: "#0F2A3D",
    background: "#edf4f8",
  }
}

function SimpleMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6b7a8d]">{label}</p>
      <p className="mt-3 text-[24px] font-extrabold text-[#0F2A3D]">{value}</p>
    </div>
  )
}

export default function OnsetInfoPage() {
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
      setError(loadError instanceof Error ? loadError.message : "Unable to load onset information.")
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
    () => districtSummaries.find((district) => district.district === selectedDistrict) ?? districtSummaries[0] ?? null,
    [districtSummaries, selectedDistrict]
  )

  const selectedTASummary = useMemo(
    () => filteredTAs.find((ta) => ta.shape_id === selectedTA) ?? null,
    [filteredTAs, selectedTA]
  )

  const activeSummary = selectedTASummary ?? selectedDistrictSummary
  const guidance = onsetGuidance(activeSummary)

  const handleRefresh = async () => {
    setRefreshing(true)

    try {
      await triggerPipelineRun("malawi")
      invalidateAlgorithmCaches()
      await loadSummaries()
    } catch (refreshError) {
      setRefreshing(false)
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh onset information.")
    }
  }

  return (
    <div className="space-y-6 bg-[#eef2f4] px-0 pb-6">
      <div className="rounded-[20px] border border-[#e9edf1] bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-[0.32em] text-[#6b7a8d]">Rainfall Onset</p>
            <h1 className="text-4xl font-bold text-[#0F2A3D]">Onset Information</h1>
            <p className="max-w-2xl text-sm leading-6 text-[#6b7a8d]">
              Select a district or T/A to see when rain onset is usually detected and whether planting conditions look steady enough.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-full border border-[#d8dee4] bg-[#f8fafb] px-4 py-3 text-sm font-semibold text-[#0F2A3D] hover:bg-[#f0f2f4]"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </button>

            <div className="relative">
              <button
                onClick={() => setShowDistrictSelector((open) => !open)}
                className="flex items-center gap-3 rounded-full border border-[#d8dee4] bg-[#f8fafb] px-4 py-3 transition-colors hover:bg-[#f0f2f4]"
              >
                <MapPin className="h-4 w-4 text-[#0b3a4a]" />
                <span className="text-sm font-medium text-[#0F2A3D]">
                  {selectedDistrictSummary?.district || "Select District"}
                </span>
              </button>

              {showDistrictSelector && (
                <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-[12px] border border-[#e2e8f0] bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-[#e2e8f0] p-4">
                    <h3 className="text-sm font-semibold text-[#0F2A3D]">Select District</h3>
                    <button onClick={() => setShowDistrictSelector(false)} className="text-[#6b7a8d] hover:text-[#0F2A3D]">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-2">
                    {districtSummaries.map((district) => (
                      <button
                        key={district.district}
                        onClick={() => {
                          setSelectedDistrict(district.district)
                          setSelectedTA(null)
                          setShowDistrictSelector(false)
                        }}
                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[#f8fafb]"
                      >
                        {district.district}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowTASelector((open) => !open)}
                disabled={!selectedDistrict}
                className="flex items-center gap-3 rounded-full border border-[#d8dee4] bg-[#f8fafb] px-4 py-3 transition-colors hover:bg-[#f0f2f4] disabled:opacity-50"
              >
                <MapPin className="h-4 w-4 text-[#0b3a4a]" />
                <span className="text-sm font-medium text-[#0F2A3D]">
                  {selectedTASummary?.traditional_authority || "Select T/A"}
                </span>
              </button>

              {showTASelector && (
                <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-[12px] border border-[#e2e8f0] bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-[#e2e8f0] p-4">
                    <h3 className="text-sm font-semibold text-[#0F2A3D]">Select Traditional Authority</h3>
                    <button onClick={() => setShowTASelector(false)} className="text-[#6b7a8d] hover:text-[#0F2A3D]">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-2">
                    <button
                      onClick={() => {
                        setSelectedTA(null)
                        setShowTASelector(false)
                      }}
                      className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[#f8fafb]"
                    >
                      All T/As in district
                    </button>
                    {filteredTAs.map((ta) => (
                      <button
                        key={ta.shape_id}
                        onClick={() => {
                          setSelectedTA(ta.shape_id ?? null)
                          setShowTASelector(false)
                        }}
                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[#f8fafb]"
                      >
                        {ta.traditional_authority}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="rounded-2xl bg-[#fff5f5] px-5 py-4 text-sm text-[#8a3030]">{error}</div>}

      <div
        className="rounded-[20px] border px-5 py-5 shadow-sm"
        style={{ background: guidance.background, borderColor: "rgba(15,42,61,0.08)" }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70">
            <CloudRain className="h-5 w-5" style={{ color: guidance.tone }} />
          </div>
          <div>
            <p className="text-[18px] font-bold" style={{ color: guidance.tone }}>{guidance.title}</p>
            <p className="mt-2 text-[14px] leading-6 text-[#4f6472]">
              {guidance.body}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SimpleMetric
          label="Onset seen in seasons"
          value={`${Math.round((activeSummary?.onset_detection_rate ?? 0) * 100)}%`}
        />
        <SimpleMetric
          label="First onset date"
          value={formatDateLabel(activeSummary?.first_detected_onset_date ?? null)}
        />
        <SimpleMetric
          label="Latest onset date"
          value={formatDateLabel(activeSummary?.latest_detected_onset_date ?? null)}
        />
        <SimpleMetric
          label="Seasons analyzed"
          value={`${activeSummary?.seasons_analyzed ?? 0}`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[20px] border border-[#e9edf1] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-[#0F2A3D]" />
            <h2 className="text-[20px] font-bold text-[#0F2A3D]">What this means for planting</h2>
          </div>

          <div className="mt-5 space-y-4 text-[14px] leading-7 text-[#4f6472]">
            <p>
              The onset date is the time when the algorithm detects a meaningful start of seasonal rain.
            </p>
            <p>
              If onset is detected often and false-onset risk is low, planting is generally safer after the first good rains.
            </p>
            <p>
              If false-onset or crop-stress risk is high, it is better to wait for follow-up rain before planting a large area.
            </p>
          </div>
        </div>

        <div className="rounded-[20px] border border-[#e9edf1] bg-white p-6 shadow-sm">
          <h2 className="text-[20px] font-bold text-[#0F2A3D]">Selected Area Summary</h2>
          <div className="mt-5 space-y-4 text-[14px] leading-6 text-[#4f6472]">
            <p>
              <span className="font-semibold text-[#0F2A3D]">Area:</span>{" "}
              {selectedTASummary
                ? `${selectedTASummary.traditional_authority}, ${selectedTASummary.district}`
                : selectedDistrictSummary?.district || "Not selected"}
            </p>
            <p>
              <span className="font-semibold text-[#0F2A3D]">Grid cells used:</span>{" "}
              {activeSummary?.grid_cell_count ?? 0}
            </p>
            <p>
              <span className="font-semibold text-[#0F2A3D]">False-onset risk:</span>{" "}
              {Math.round((activeSummary?.average_false_onset_probability ?? 0) * 100)}%
            </p>
            <p>
              <span className="font-semibold text-[#0F2A3D]">Crop-stress risk:</span>{" "}
              {Math.round((activeSummary?.average_crop_stress_probability ?? 0) * 100)}%
            </p>
          </div>
        </div>
      </div>

      {loading && <div className="rounded-2xl bg-white px-5 py-4 text-sm text-[#6b7a8d]">Loading live onset summaries...</div>}
    </div>
  )
}
