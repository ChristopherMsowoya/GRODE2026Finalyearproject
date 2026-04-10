export interface AlgorithmResult {
  grid_id: string
  latitude: number
  longitude: number
  seasons_analyzed: number
  seasons_with_detected_onset: number
  first_detected_onset_date: string | null
  latest_detected_onset_date: string | null
  false_onset_probability: number
  crop_stress_probability: number
  overall_risk_level: "Low" | "Medium" | "High"
  false_onset_interpretation: string
  crop_stress_interpretation: string
}

export interface AlgorithmSummary {
  result_count: number
  seasons_analyzed: number
  risk_counts: {
    Low: number
    Medium: number
    High: number
  }
  average_false_onset_probability: number
  average_crop_stress_probability: number
  highest_risk_cells: AlgorithmResult[]
}

export interface DistrictSummary {
  district: string
  shape_id?: string
  grid_cell_count: number
  seasons_analyzed: number
  onset_detection_rate: number
  first_detected_onset_date: string | null
  latest_detected_onset_date: string | null
  average_false_onset_probability: number
  average_crop_stress_probability: number
  overall_risk_probability: number
  overall_risk_level: "Low" | "Medium" | "High"
}

export interface DistrictSummaryResponse {
  district_count: number
  districts: DistrictSummary[]
}

export interface TraditionalAuthoritySummary {
  traditional_authority: string
  shape_id?: string
  district: string | null
  grid_cell_count: number
  seasons_analyzed: number
  onset_detection_rate: number
  first_detected_onset_date: string | null
  latest_detected_onset_date: string | null
  average_false_onset_probability: number
  average_crop_stress_probability: number
  overall_risk_probability: number
  overall_risk_level: "Low" | "Medium" | "High"
}

export interface TraditionalAuthoritySummaryResponse {
  traditional_authority_count: number
  traditional_authorities: TraditionalAuthoritySummary[]
}

export interface GeoJsonFeature {
  type: string
  properties: Record<string, string | number | boolean | null>
  geometry: {
    type: string
    coordinates: unknown
  }
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection"
  features: GeoJsonFeature[]
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000"

const boundaryCache = new Map<string, Promise<GeoJsonFeatureCollection>>()
const districtSummaryCache = new Map<string, Promise<DistrictSummaryResponse>>()
const algorithmSummaryCache = new Map<string, Promise<AlgorithmSummary>>()
const taSummaryCache = new Map<string, Promise<TraditionalAuthoritySummaryResponse>>()

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  })

  if (!response.ok) {
    let detail = "Request failed."

    try {
      const errorBody = await response.json()
      detail = errorBody.detail || detail
    } catch {
      // Ignore JSON parsing errors and keep the generic message.
    }

    throw new Error(detail)
  }

  return response.json()
}

export function getApiBaseUrl() {
  return API_BASE_URL
}

export function fetchAlgorithmResults() {
  return apiFetch<AlgorithmResult[]>("/api/results")
}

export function fetchAlgorithmSummary() {
  const key = "algorithm-summary"

  if (!algorithmSummaryCache.has(key)) {
    algorithmSummaryCache.set(key, apiFetch<AlgorithmSummary>("/api/results/summary"))
  }

  return algorithmSummaryCache.get(key)!
}

export function fetchDistrictSummary() {
  const key = "district-summary"

  if (!districtSummaryCache.has(key)) {
    districtSummaryCache.set(key, apiFetch<DistrictSummaryResponse>("/api/results/district-summary"))
  }

  return districtSummaryCache.get(key)!
}

export function fetchTraditionalAuthoritySummary() {
  const key = "ta-summary"

  if (!taSummaryCache.has(key)) {
    taSummaryCache.set(key, apiFetch<TraditionalAuthoritySummaryResponse>("/api/results/ta-summary"))
  }

  return taSummaryCache.get(key)!
}

export function triggerPipelineRun(region = "malawi") {
  return apiFetch<{ status: string; region: string; result_count: number }>(
    "/api/pipeline/run",
    {
      method: "POST",
      body: JSON.stringify({ region }),
    }
  )
}

export function fetchBoundaries(
  level: "country" | "regions" | "districts" | "traditional-authorities",
  simplified = true
) {
  const key = `${level}:${simplified ? "simplified" : "full"}`

  if (!boundaryCache.has(key)) {
    boundaryCache.set(
      key,
      apiFetch<GeoJsonFeatureCollection>(
        `/api/boundaries/${level}?simplified=${simplified ? "true" : "false"}`
      )
    )
  }

  return boundaryCache.get(key)!
}

export function invalidateAlgorithmCaches() {
  algorithmSummaryCache.clear()
  districtSummaryCache.clear()
  taSummaryCache.clear()
}
