export interface AlgorithmResult {
  grid_id: string
  latitude: number
  longitude: number
  seasons_analyzed: number
  seasons_with_detected_onset: number
  first_detected_onset_date: string | null
  latest_detected_onset_date: string | null
  false_onset_probability: number
  dry_spell_probability: number
  overall_risk_level: "Low" | "Medium" | "High"
  false_onset_interpretation: string
  dry_spell_interpretation: string
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
  average_dry_spell_probability: number
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
  average_dry_spell_probability: number
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
  average_dry_spell_probability: number
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

export interface LocationHierarchyResponse {
  district_count: number
  districts: Array<{
    district: string
    ta_count: number
    traditional_authorities: Array<{
      ta: string
      grid_cell_count: number
      overall_risk_level: "Low" | "Medium" | "High"
      average_false_onset_probability: number
      average_dry_spell_probability: number
    }>
  }>
}

export interface TaGridsResponse {
  grid_count: number
  traditional_authority: string
  district: string | null
  grids: Array<Record<string, unknown>>
}

export interface GeoJsonFeature {
  type: string
  properties: Record<string, string | number | boolean | null>
  geometry: {
    type: string
    coordinates: unknown
  }
}

export type DiagnosticLayer = "onset" | "false_onset" | "dry_spell"

export interface GridDiagnosticProperties {
  grid_id: string
  grid_code?: string | null
  centroid_lat?: number | null
  centroid_lon?: number | null
  latitude?: number | null
  longitude?: number | null
  district_name?: string | null
  seasons_analyzed?: number | null
  seasons_with_detected_onset?: number | null
  first_detected_onset_date?: string | null
  latest_detected_onset_date?: string | null
  onset_probability?: number | null
  false_onset_probability?: number | null
  dry_spell_probability?: number | null
  false_onset_interpretation?: string | null
  dry_spell_interpretation?: string | null
  overall_risk_level?: "Low" | "Medium" | "High" | null
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection"
  features: GeoJsonFeature[]
}

export interface GridSeasonDiagnostic {
  season: string
  season_year?: number | null
  onset_probability?: number | null
  false_onset_probability?: number | null
  dry_spell_probability?: number | null
  onset_detected?: boolean
  false_onset_detected?: boolean
  dry_spell_detected?: boolean
  dry_spell_max_length_days?: number | null
  dry_day_count?: number | null
}

export interface GridHistoryResponse {
  grid_id: string
  season_count: number
  seasons: GridSeasonDiagnostic[]
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000"
const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
const API_BASE_URL = (configuredApiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "")
const API_TIMEOUT_MS = 10000
const API_RETRIES = 2
const API_RETRY_DELAY_MS = 350

const boundaryCache = new Map<string, Promise<GeoJsonFeatureCollection>>()
const districtSummaryCache = new Map<string, Promise<DistrictSummaryResponse>>()
const algorithmSummaryCache = new Map<string, Promise<AlgorithmSummary>>()
const taSummaryCache = new Map<string, Promise<TraditionalAuthoritySummaryResponse>>()
const taGridCountCache = new Map<string, Promise<TraditionalAuthorityGridCountResponse>>()
const gridDiagnosticsCache = new Map<string, Promise<GeoJsonFeatureCollection>>()
const loggedApiFailures = new Set<string>()

type ApiFetchOptions<T> = Omit<RequestInit, "signal"> & {
  fallback?: T
  retries?: number
  retryDelayMs?: number
  signal?: AbortSignal
  timeoutMs?: number
}

class ApiRequestError extends Error {
  status?: number
  retryable: boolean

  constructor(message: string, options: { status?: number; retryable?: boolean } = {}) {
    super(message)
    this.name = "ApiRequestError"
    this.status = options.status
    this.retryable = options.retryable ?? false
  }
}

const EMPTY_FEATURE_COLLECTION: GeoJsonFeatureCollection = { type: "FeatureCollection", features: [] }
const EMPTY_ALGORITHM_SUMMARY: AlgorithmSummary = {
  result_count: 0,
  seasons_analyzed: 0,
  risk_counts: { Low: 0, Medium: 0, High: 0 },
  average_false_onset_probability: 0,
  average_dry_spell_probability: 0,
  highest_risk_cells: [],
}
const EMPTY_DISTRICT_SUMMARY: DistrictSummaryResponse = { district_count: 0, districts: [] }
const EMPTY_TA_SUMMARY: TraditionalAuthoritySummaryResponse = {
  traditional_authority_count: 0,
  traditional_authorities: [],
}
const EMPTY_TA_GRID_COUNTS: TraditionalAuthorityGridCountResponse = {
  traditional_authority_count: 0,
  traditional_authorities: [],
}
const EMPTY_GRID_HISTORY = (gridId: string): GridHistoryResponse => ({
  grid_id: gridId,
  season_count: 0,
  seasons: [],
})
const EMPTY_LOCATION_SEARCH = (query: string): LocationSearchResponse => ({
  query,
  match_count: 0,
  locations: [],
})
const EMPTY_LOCATION_HIERARCHY: LocationHierarchyResponse = { district_count: 0, districts: [] }

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function isRetryableApiError(error: unknown) {
  if (error instanceof ApiRequestError) return error.retryable
  if (error instanceof TypeError) return true
  return isAbortError(error)
}

function toUserFacingApiError(error: unknown) {
  if (error instanceof ApiRequestError) return error
  if (error instanceof TypeError) {
    return new ApiRequestError(`Backend service unavailable at ${API_BASE_URL}.`, { retryable: true })
  }
  if (isAbortError(error)) {
    return new ApiRequestError("Backend request timed out.", { retryable: true })
  }
  if (error instanceof Error) return error
  return new Error("Backend request failed.")
}

function warnApiFailure(path: string, error: unknown, usingFallback: boolean) {
  const key = `${path}:${usingFallback ? "fallback" : "throw"}`
  if (loggedApiFailures.has(key)) return
  loggedApiFailures.add(key)

  const message = error instanceof Error ? error.message : "Backend request failed."
  console.warn(
    `API request warning: ${path} could not reach ${API_BASE_URL}. ${
      usingFallback ? "Using fallback data." : "No fallback configured."
    } ${message}`
  )
}

function cachePromise<T>(cache: Map<string, Promise<T>>, key: string, factory: () => Promise<T>) {
  if (!cache.has(key)) {
    const promise = factory().catch((error) => {
      cache.delete(key)
      throw error
    })
    cache.set(key, promise)
  }

  return cache.get(key)!
}

async function apiFetch<T>(path: string, init: ApiFetchOptions<T> = {}): Promise<T> {
  const {
    fallback,
    retries = API_RETRIES,
    retryDelayMs = API_RETRY_DELAY_MS,
    timeoutMs = API_TIMEOUT_MS,
    signal,
    ...requestInit
  } = init

  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    let didTimeout = false
    const timeoutId = setTimeout(() => {
      didTimeout = true
      controller.abort()
    }, timeoutMs)

    const abortFromParent = () => controller.abort()
    if (signal?.aborted) controller.abort()
    signal?.addEventListener("abort", abortFromParent, { once: true })

    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...requestInit,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(requestInit.headers || {}),
        },
        cache: "no-store",
      })

      if (!response.ok) {
        let detail = "Request failed."

        try {
          const errorBody = await response.json()
          detail = errorBody.detail || detail
        } catch {
          // Keep the generic message when the backend does not return JSON.
        }

        throw new ApiRequestError(detail, {
          status: response.status,
          retryable: response.status >= 500 || response.status === 408 || response.status === 429,
        })
      }

      if (response.status === 204) return undefined as T
      return response.json()
    } catch (error) {
      lastError = didTimeout
        ? new ApiRequestError("Backend request timed out.", { retryable: true })
        : toUserFacingApiError(error)

      if (signal?.aborted || attempt >= retries || !isRetryableApiError(lastError)) break
      await delay(retryDelayMs * (attempt + 1))
    } finally {
      clearTimeout(timeoutId)
      signal?.removeEventListener("abort", abortFromParent)
    }
  }

  if (fallback !== undefined) {
    warnApiFailure(path, lastError, true)
    return fallback
  }

  warnApiFailure(path, lastError, false)
  throw toUserFacingApiError(lastError)
}

export function getApiBaseUrl() {
  return API_BASE_URL
}

export function fetchAlgorithmResults() {
  return apiFetch<AlgorithmResult[]>('/api/results', { fallback: [] })
}

export function fetchAlgorithmSummary() {
  const key = "algorithm-summary"

  return cachePromise(
    algorithmSummaryCache,
    key,
    () => apiFetch<AlgorithmSummary>('/api/results/summary', { fallback: EMPTY_ALGORITHM_SUMMARY })
  )
}

export function fetchDistrictSummary() {
  return apiFetch<DistrictSummaryResponse>('/api/results/district-summary', {
    fallback: EMPTY_DISTRICT_SUMMARY,
  })
}

export function fetchTraditionalAuthoritySummary() {
  const key = "ta-summary"

  return cachePromise(
    taSummaryCache,
    key,
    () => apiFetch<TraditionalAuthoritySummaryResponse>('/api/results/ta-summary', { fallback: EMPTY_TA_SUMMARY })
  )
}

export function fetchDatabaseHealth() {
  return apiFetch<DatabaseHealthResponse>("/api/database/health", {
    fallback: { status: "offline", grid_cell_count: 0 },
  })
}

export function fetchTraditionalAuthorityGridCounts() {
  const key = "ta-grid-counts"

  return cachePromise(
    taGridCountCache,
    key,
    () => apiFetch<TraditionalAuthorityGridCountResponse>('/api/grid/ta-counts', { fallback: EMPTY_TA_GRID_COUNTS })
  )
}

export function searchLocations(name: string, limit = 10, signal?: AbortSignal) {
  const params = new URLSearchParams({
    name,
    limit: String(limit),
  })

  return apiFetch<LocationSearchResponse>(`/api/locations/search?${params.toString()}`, {
    fallback: EMPTY_LOCATION_SEARCH(name),
    signal,
    timeoutMs: 8000,
  })
}

export function fetchLocationHierarchy(signal?: AbortSignal) {
  return apiFetch<LocationHierarchyResponse>("/api/locations/hierarchy", {
    fallback: EMPTY_LOCATION_HIERARCHY,
    signal,
  })
}

export function fetchTaGrids(district: string, ta: string, signal?: AbortSignal) {
  const params = new URLSearchParams({
    district,
    ta,
  })

  return apiFetch<TaGridsResponse>(`/api/locations/ta-grids?${params.toString()}`, {
    fallback: {
      grid_count: 0,
      traditional_authority: ta,
      district,
      grids: [],
    },
    signal,
  })
}

export function triggerPipelineRun(region = "malawi") {
  return apiFetch<{ status: string; region: string; result_count: number }>(
    "/api/pipeline/run",
    {
      method: "POST",
      body: JSON.stringify({ region }),
    }
  ).then((result) => {
    invalidateAlgorithmCaches()
    return result
  })
}

// Grid helpers — new DB-backed endpoints
export function fetchGridCells(params?: { limit?: number; offset?: number; source_grid?: string }) {
  const qs = new URLSearchParams()

  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))
  if (params?.source_grid) qs.set('source_grid', params.source_grid)

  const path = `/api/grid/cells${qs.toString() ? `?${qs.toString()}` : ''}`
  return apiFetch<any>(path, { fallback: EMPTY_FEATURE_COLLECTION }).then(normalizeGeoJsonCollection)
}

export function fetchGridDiagnostics(params?: { limit?: number; offset?: number; source_grid?: string }) {
  const qs = new URLSearchParams()

  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))
  if (params?.source_grid) qs.set('source_grid', params.source_grid)

  const path = `/api/grid/diagnostic-cells${qs.toString() ? `?${qs.toString()}` : ''}`
  return cachePromise(
    gridDiagnosticsCache,
    path,
    () => apiFetch<any>(path, { fallback: EMPTY_FEATURE_COLLECTION }).then(normalizeGeoJsonCollection)
  )
}

export function fetchGridCell(gridId: string) {
  return apiFetch<any>(`/api/grid/cells/${encodeURIComponent(gridId)}`, {
    fallback: null,
  }).then(normalizeGeoJsonFeature)
}

export function fetchGridIntersections(gridId?: string) {
  const qs = new URLSearchParams()

  if (gridId) qs.set('grid_id', gridId)

  const path = `/api/grid/intersections${qs.toString() ? `?${qs.toString()}` : ''}`
  return apiFetch<any>(path, { fallback: EMPTY_FEATURE_COLLECTION }).then(normalizeGeoJsonCollection)
}

export function fetchPipelineResults(gridId: string, limit = 100) {
  const qs = new URLSearchParams()
  if (gridId) qs.set('grid_id', gridId)
  if (limit) qs.set('limit', String(limit))
  const path = `/api/pipeline-results${qs.toString() ? `?${qs.toString()}` : ''}`
  return apiFetch<any>(path, { fallback: { count: 0, data: [] } })
}

export function fetchGridHistory(gridId: string) {
  return apiFetch<GridHistoryResponse>(`/api/grid/cells/${encodeURIComponent(gridId)}/history`, {
    fallback: EMPTY_GRID_HISTORY(gridId),
  })
}

export function fetchAllPipelineResults(limit = 10000) {
  const qs = new URLSearchParams()
  if (limit) qs.set('limit', String(limit))
  const path = `/api/pipeline-results${qs.toString() ? `?${qs.toString()}` : ''}`
  return apiFetch<any>(path, { fallback: { count: 0, data: [] } })
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
  if (raw.geom) {
    try {
      const geom = typeof raw.geom === 'string' ? JSON.parse(raw.geom) : raw.geom
      const props = { ...raw }
      delete props.geom
      return { type: 'Feature', properties: props, geometry: geom }
    } catch {
      // fallthrough
    }
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
  if (Array.isArray(raw.rows)) return normalizeGeoJsonCollection(raw.rows)
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
      if (r.type === 'Feature') return normalizeGeoJsonFeature(r)
      if (r.geom) {
        try {
          const geom = typeof r.geom === 'string' ? JSON.parse(r.geom) : r.geom
          const props = { ...r }
          delete props.geom
          return { type: 'Feature', properties: props, geometry: geom }
        } catch {}
      }
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

  return cachePromise(
    boundaryCache,
    key,
    () => apiFetch<GeoJsonFeatureCollection>(
      `/api/boundaries/${level}?simplified=${simplified ? "true" : "false"}`,
      { fallback: EMPTY_FEATURE_COLLECTION }
    )
  )
}

export function invalidateAlgorithmCaches() {
  algorithmSummaryCache.clear()
  districtSummaryCache.clear()
  taSummaryCache.clear()
  taGridCountCache.clear()
  gridDiagnosticsCache.clear()
}
