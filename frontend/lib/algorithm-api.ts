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

export interface DatabaseHealthResponse {
  status: string
  grid_cell_count: number
}

export interface TraditionalAuthorityGridCount {
  traditional_authority: string
  district: string | null
  grid_cell_count: number
}

export interface TraditionalAuthorityGridCountResponse {
  traditional_authority_count: number
  traditional_authorities: TraditionalAuthorityGridCount[]
}

export interface LocationSearchResult {
  location_name: string
  district: string | null
  traditional_authority: string | null
  grid_id: string | null
  longitude: number
  latitude: number
  place_type: string | null
  population: string | null
}

export interface LocationSearchResponse {
  query: string
  match_count: number
  locations: LocationSearchResult[]
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
const taGridCountCache = new Map<string, Promise<TraditionalAuthorityGridCountResponse>>()

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
  return apiFetch<AlgorithmResult[]>('/api/results')
}

export function fetchAlgorithmSummary() {
  const key = "algorithm-summary"

  if (!algorithmSummaryCache.has(key)) {
    algorithmSummaryCache.set(key, apiFetch<AlgorithmSummary>('/api/results/summary'))
  }

  return algorithmSummaryCache.get(key)!
}

export function fetchDistrictSummary() {
  // Always fetch fresh -- results update whenever pipeline runs
  return apiFetch<DistrictSummaryResponse>('/api/results/district-summary')
}

export function fetchTraditionalAuthoritySummary() {
  const key = "ta-summary"

  if (!taSummaryCache.has(key)) {
    taSummaryCache.set(key, apiFetch<TraditionalAuthoritySummaryResponse>('/api/results/ta-summary'))
  }

  return taSummaryCache.get(key)!
}

export function fetchDatabaseHealth() {
  return apiFetch<DatabaseHealthResponse>("/api/database/health")
}

export function fetchTraditionalAuthorityGridCounts() {
  const key = "ta-grid-counts"

  if (!taGridCountCache.has(key)) {
    // New backend exposes grid cell endpoints under /api/grid
    taGridCountCache.set(
      key,
      apiFetch<TraditionalAuthorityGridCountResponse>('/api/grid/ta-counts')
    )
  }

  return taGridCountCache.get(key)!
}

export function searchLocations(name: string, limit = 10) {
  const params = new URLSearchParams({
    name,
    limit: String(limit),
  })

  return apiFetch<LocationSearchResponse>(`/api/locations/search?${params.toString()}`)
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

// Grid helpers — new DB-backed endpoints
export function fetchGridCells(params?: { limit?: number; offset?: number; source_grid?: string }) {
  const qs = new URLSearchParams()

  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))
  if (params?.source_grid) qs.set('source_grid', params.source_grid)

  const path = `/api/grid/cells${qs.toString() ? `?${qs.toString()}` : ''}`
  return apiFetch<any>(path).then(normalizeGeoJsonCollection)
}

export function fetchGridCell(gridId: string) {
  return apiFetch<any>(`/api/grid/cells/${encodeURIComponent(gridId)}`).then(normalizeGeoJsonFeature)
}

export function fetchGridIntersections(gridId?: string) {
  const qs = new URLSearchParams()

  if (gridId) qs.set('grid_id', gridId)

  const path = `/api/grid/intersections${qs.toString() ? `?${qs.toString()}` : ''}`
  return apiFetch<any>(path).then(normalizeGeoJsonCollection)
}

function normalizeGeoJsonFeature(raw: any): GeoJsonFeature {
  if (!raw) return { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [] } }
  if (raw.type === 'Feature') {
    const f = { ...raw } as any
    if (typeof f.geometry === 'string') f.geometry = JSON.parse(f.geometry)
    if ((!f.geometry || !f.geometry.type) && f.properties && typeof f.properties.geom === 'string') {
      try { f.geometry = JSON.parse(f.properties.geom); delete f.properties.geom } catch {}
    }
    return f as GeoJsonFeature
  }
  // if backend returns a row object
  if (raw.st_asgeojson) {
    try {
      const geom = JSON.parse(raw.st_asgeojson)
      const props = { ...raw }
      delete (props as any).st_asgeojson
      return { type: 'Feature', properties: props, geometry: geom }
    } catch {
      // fallthrough
    }
  }
  if (raw.geometry) {
    return { type: 'Feature', properties: raw.properties || {}, geometry: raw.geometry }
  }
  return { type: 'Feature', properties: raw.properties || raw, geometry: { type: 'Point', coordinates: [raw.longitude || 0, raw.latitude || 0] } }
}

function normalizeGeoJsonCollection(raw: any): GeoJsonFeatureCollection {
  if (!raw) return { type: 'FeatureCollection', features: [] }
  if (raw.type === 'FeatureCollection' && Array.isArray(raw.features)) {
    const features = raw.features.map((f: any) => {
      if (typeof f.geometry === 'string') {
        try { f.geometry = JSON.parse(f.geometry) } catch {}
      }
      if ((!f.geometry || !f.geometry.type) && f.properties && typeof f.properties.geom === 'string') {
        try { f.geometry = JSON.parse(f.properties.geom); delete f.properties.geom } catch {}
      }
      return f as GeoJsonFeature
    })
    return { type: 'FeatureCollection', features }
  }
  // If the backend returns an array of rows
  if (Array.isArray(raw)) {
    const features = raw.map((r: any) => {
      if (r.st_asgeojson) {
        try { return { type: 'Feature', properties: { ...r, st_asgeojson: undefined }, geometry: JSON.parse(r.st_asgeojson) } } catch {}
      }
      if (r.geometry && typeof r.geometry === 'string') {
        try { r.geometry = JSON.parse(r.geometry) } catch {}
      }
      const geometry = r.geometry || r.geom || (r.longitude && r.latitude ? { type: 'Point', coordinates: [r.longitude, r.latitude] } : { type: 'Point', coordinates: [0, 0] })
      const props = { ...r }
      delete props.geometry
      delete props.geom
      delete props.st_asgeojson
      return { type: 'Feature', properties: props, geometry }
    })
    return { type: 'FeatureCollection', features }
  }
  // Fallback: try to coerce single feature
  return { type: 'FeatureCollection', features: [normalizeGeoJsonFeature(raw)] }
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
  taGridCountCache.clear()
}
