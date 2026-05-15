"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import type { Layer, Map as LeafletMap, PathOptions } from "leaflet"
import { Database, Layers, Loader2, MapPin, Minus, Navigation2, Plus, Search, X } from "lucide-react"
import GridGraph from "@/components/grid-graph"
import {
  fetchBoundaries,
  fetchDatabaseHealth,
  fetchGridDiagnostics,
  searchLocations,
  type DatabaseHealthResponse,
  type DiagnosticLayer,
  type GeoJsonFeatureCollection,
  type GridDiagnosticProperties,
  type LocationSearchResult,
} from "@/lib/algorithm-api"
import type { SelectedLocation } from "@/components/location-selector"

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false })
const GeoJSON = dynamic(() => import("react-leaflet").then((m) => m.GeoJSON), { ssr: false })
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false })

const LAYER_CONFIG: Record<DiagnosticLayer, { label: string; shortLabel: string; color: string }> = {
  onset: { label: "Onset Probability", shortLabel: "Onset", color: "#1F7A63" },
  false_onset: { label: "False-Onset Probability", shortLabel: "False-Onset", color: "#D64545" },
  dry_spell: { label: "Dry Spell Probability", shortLabel: "Dry Spell", color: "#2563eb" },
}

const LEGEND_BINS = [
  { min: 0, max: 20, label: "Very Low", color: "#dbeafe" },
  { min: 21, max: 40, label: "Low", color: "#93c5fd" },
  { min: 41, max: 60, label: "Moderate", color: "#facc15" },
  { min: 61, max: 80, label: "High", color: "#fb923c" },
  { min: 81, max: 100, label: "Very High", color: "#dc2626" },
]

const TILES = {
  terrain: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attr: "OpenTopoMap" },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Esri" },
  street: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "OpenStreetMap" },
}

function probabilityForLayer(props: Record<string, any>, layer: DiagnosticLayer) {
  if (layer === "false_onset") return Number(props.false_onset_probability ?? 0)
  if (layer === "dry_spell") return Number(props.dry_spell_probability ?? 0)
  return Number(props.onset_probability ?? 0)
}

function colorForProbability(probability: number) {
  const pct = Math.max(0, Math.min(100, probability * 100))
  return LEGEND_BINS.find((bin) => pct >= bin.min && pct <= bin.max)?.color ?? LEGEND_BINS[0].color
}

function percent(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "-"
}

function dateOnly(value?: string | null) {
  return value ? value.split("T")[0].split(" ")[0] : "-"
}

function makeDistrictIcon(name: string, leaflet: typeof import("leaflet")) {
  return leaflet.divIcon({
    className: "district-label",
    html: `<span>${name}</span>`,
    iconSize: [120, 22],
    iconAnchor: [60, 11],
  })
}

function selectedLocationFromGrid(props: GridDiagnosticProperties): SelectedLocation {
  const seasons = props.seasons_analyzed ?? 0
  const onsetRate = props.onset_probability ?? (
    props.seasons_with_detected_onset && seasons ? props.seasons_with_detected_onset / seasons : 0
  )

  return {
    district: props.district_name || "Unknown",
    ta: null,
    taData: null,
    grid: props.grid_id,
    areaName: props.grid_code || props.grid_id,
    gridData: {
      grid_id: props.grid_id,
      latitude: Number(props.centroid_lat ?? props.latitude ?? 0),
      longitude: Number(props.centroid_lon ?? props.longitude ?? 0),
      overall_risk_level: props.overall_risk_level || "Low",
      false_onset_probability: props.false_onset_probability ?? 0,
      dry_spell_probability: props.dry_spell_probability ?? 0,
      onset_probability: onsetRate,
      seasons_analyzed: seasons,
      seasons_with_detected_onset: props.seasons_with_detected_onset ?? 0,
      first_detected_onset_date: props.first_detected_onset_date ?? null,
      latest_detected_onset_date: props.latest_detected_onset_date ?? null,
      false_onset_interpretation: props.false_onset_interpretation ?? "",
      dry_spell_interpretation: props.dry_spell_interpretation ?? "",
    },
  }
}

export default function MapPage() {
  const mapRef = useRef<LeafletMap | null>(null)
  const [activeLayer, setActiveLayer] = useState<DiagnosticLayer>("onset")
  const [layerStyle, setLayerStyle] = useState<"terrain" | "satellite" | "street">("terrain")
  const [gridGeo, setGridGeo] = useState<GeoJsonFeatureCollection | null>(null)
  const [countryGeo, setCountryGeo] = useState<GeoJsonFeatureCollection | null>(null)
  const [districtGeo, setDistrictGeo] = useState<GeoJsonFeatureCollection | null>(null)
  const [selectedGrid, setSelectedGrid] = useState<SelectedLocation | null>(null)
  const [hoveredGrid, setHoveredGrid] = useState<GridDiagnosticProperties | null>(null)
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([])
  const [selectedPlace, setSelectedPlace] = useState<LocationSearchResult | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [dbHealth, setDbHealth] = useState<DatabaseHealthResponse | null>(null)
  const [leaflet, setLeaflet] = useState<typeof import("leaflet") | null>(null)
  const [showDistrictLabels, setShowDistrictLabels] = useState(true)

  const tile = TILES[layerStyle]

  const districtLabels = useMemo(() => {
    if (!districtGeo?.features) return []
    return districtGeo.features
      .map((feature) => {
        const geometry = feature.geometry as any
        const ring = geometry?.type === "Polygon" ? geometry.coordinates?.[0] : geometry?.coordinates?.[0]?.[0]
        if (!Array.isArray(ring) || ring.length === 0) return null
        const total = ring.reduce((acc: { lon: number; lat: number }, point: number[]) => ({ lon: acc.lon + point[0], lat: acc.lat + point[1] }), { lon: 0, lat: 0 })
        const name = String(feature.properties?.shapeName || feature.properties?.name || "")
        return { name, lat: total.lat / ring.length, lon: total.lon / ring.length }
      })
      .filter(Boolean) as { name: string; lat: number; lon: number }[]
  }, [districtGeo])

  useEffect(() => {
    let cancelled = false

    async function loadMapData() {
      try {
        const [health, country, districts, grid] = await Promise.all([
          fetchDatabaseHealth(),
          fetchBoundaries("country", true),
          fetchBoundaries("districts", true),
          fetchGridDiagnostics({ limit: 12000, source_grid: "esri_5km_v1" }),
        ])

        if (cancelled) return
        setDbHealth(health)
        setCountryGeo(country)
        setDistrictGeo(districts)
        setGridGeo(grid)

        const firstGrid = grid.features[0]?.properties as unknown as GridDiagnosticProperties | undefined
        if (firstGrid?.grid_id) setSelectedGrid(selectedLocationFromGrid(firstGrid))
      } catch (error) {
        if (!cancelled) setDataError(error instanceof Error ? error.message : "Failed to load grid diagnostics.")
      }
    }

    loadMapData()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let mounted = true
    import("leaflet").then((module) => {
      if (mounted) setLeaflet(module)
    })
    return () => {
      mounted = false
    }
  }, [])

  const gridStyle = useCallback((feature?: GeoJSON.Feature): PathOptions => {
    const props = (feature?.properties || {}) as any
    const isSelected = selectedGrid?.grid === props.grid_id
    const fillColor = colorForProbability(probabilityForLayer(props, activeLayer))
    return {
      fillColor,
      color: isSelected ? "#ffffff" : "#334155",
      weight: isSelected ? 1.8 : 0.35,
      opacity: isSelected ? 1 : 0.55,
      fillOpacity: isSelected ? 0.92 : 0.72,
    }
  }, [activeLayer, selectedGrid])

  const onEachGrid = useCallback((feature: GeoJSON.Feature, layer: Layer) => {
    const props = (feature.properties || {}) as GridDiagnosticProperties
    const summary = `
      <div style="font-family:Inter,sans-serif;min-width:220px;color:#0f2a3d">
        <strong>Grid ${props.grid_id}</strong><br/>
        <span style="color:#64748b">District:</span> ${props.district_name || "Unknown"}<br/>
        <span style="color:#64748b">Onset Probability:</span> ${percent(props.onset_probability)}<br/>
        <span style="color:#64748b">False-Onset Probability:</span> ${percent(props.false_onset_probability)}<br/>
        <span style="color:#64748b">Dry Spell Probability:</span> ${percent(props.dry_spell_probability)}<br/>
        <span style="color:#64748b">Season Summary:</span> ${props.seasons_analyzed ?? 0} seasons, median onset ${dateOnly(props.first_detected_onset_date)}
      </div>
    `

    ;(layer as any).bindTooltip(`Grid ${props.grid_id}: ${percent(probabilityForLayer(props as any, activeLayer))}`, { sticky: true })
    ;(layer as any).bindPopup(summary)
    layer.on({
      mouseover(event: any) {
        setHoveredGrid(props)
        event.target.setStyle({ weight: 1.6, fillOpacity: 0.95 })
      },
      mouseout(event: any) {
        setHoveredGrid(null)
        event.target.setStyle(gridStyle(feature))
      },
      click() {
        setSelectedGrid(selectedLocationFromGrid(props))
      },
    })
  }, [activeLayer, gridStyle])

  async function handleSearch() {
    const trimmed = query.trim()
    if (trimmed.length < 2) return
    setSearchLoading(true)
    setDataError(null)
    try {
      const response = await searchLocations(trimmed, 8)
      setSearchResults(response.locations)
      const first = response.locations[0] ?? null
      setSelectedPlace(first)
      if (first) mapRef.current?.setView([first.latitude, first.longitude], 11)
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Search failed.")
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const zoomIn = () => mapRef.current?.zoomIn()
  const zoomOut = () => mapRef.current?.zoomOut()
  const recenter = () => mapRef.current?.setView([-13.5, 34.2], 7)
  const cycleLayer = () => setLayerStyle((current) => current === "terrain" ? "satellite" : current === "satellite" ? "street" : "terrain")

  return (
    <>
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .leaflet-container { background: #e6eef2 !important; font-family: Inter, sans-serif; }
        .leaflet-control-zoom, .leaflet-control-attribution { display: none !important; }
        .district-label { pointer-events: none; }
        .district-label span {
          display: inline-flex;
          padding: 2px 7px;
          border-radius: 999px;
          background: rgba(15,42,61,0.78);
          color: white;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.04em;
          box-shadow: 0 1px 8px rgba(15,42,61,0.18);
        }
      `}</style>

      <div className="mb-4 rounded-xl border border-[#d8dee4] bg-white p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight text-[#0F2A3D]">Grid-Level Rainfall Diagnostics</h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[#64748b]">
              5km computational grid cells carry the rainfall probabilities. Districts are shown as reference overlays only.
            </p>
          </div>

          <div className="relative min-w-0 xl:w-[470px]">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void handleSearch()}
                  placeholder="Search a place, then inspect its grid cell"
                  className="w-full rounded-lg border border-[#d8dee4] bg-[#f8fafb] py-3 pl-10 pr-3 text-sm outline-none focus:border-[#0F2A3D]"
                />
              </div>
              <button
                onClick={() => void handleSearch()}
                disabled={searchLoading || query.trim().length < 2}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F2A3D] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Find
              </button>
            </div>

            {searchResults.length > 1 && (
              <div className="absolute left-0 top-14 z-[1000] max-h-60 w-full overflow-y-auto rounded-xl border border-[#e2e8f0] bg-white p-2 shadow-xl">
                {searchResults.map((row, idx) => (
                  <button
                    key={`${row.location_name}-${row.longitude}-${row.latitude}-${idx}`}
                    onClick={() => {
                      setSelectedPlace(row)
                      setSearchResults([])
                      setQuery("")
                      mapRef.current?.setView([row.latitude, row.longitude], 11)
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-[#f0f4f8]"
                  >
                    <span>
                      <span className="block text-[13px] font-semibold text-[#0F2A3D]">{row.location_name}</span>
                      <span className="block text-[11px] text-[#64748b]">{row.traditional_authority || "Unknown TA"} | {row.district || "Unknown district"}</span>
                    </span>
                    <MapPin className="h-4 w-4 text-[#1F7A63]" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {dataError && (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm font-medium text-[#b91c1c]">{dataError}</div>
      )}

      <div className="relative overflow-hidden rounded-xl border border-[#d8dee4] bg-white" style={{ height: "calc(100vh - 11rem)", minHeight: 650 }}>
        <MapContainer center={[-13.5, 34.2]} zoom={7} style={{ height: "100%", width: "100%" }} zoomControl={false} ref={mapRef}>
          <TileLayer key={layerStyle} url={tile.url} attribution={tile.attr} />
          {gridGeo && <GeoJSON key={`grid-${activeLayer}-${selectedGrid?.grid || "none"}-${gridGeo.features.length}`} data={gridGeo as any} style={gridStyle} onEachFeature={onEachGrid} />}
          {countryGeo && <GeoJSON data={countryGeo as any} style={{ color: "#0F2A3D", weight: 2.4, fillOpacity: 0, opacity: 1 }} />}
          {districtGeo && <GeoJSON data={districtGeo as any} style={{ color: "#111827", weight: 1.1, fillOpacity: 0, opacity: 0.85, dashArray: "3,4" }} />}
          {leaflet && showDistrictLabels && districtLabels.map((label) => <Marker key={label.name} position={[label.lat, label.lon]} icon={makeDistrictIcon(label.name, leaflet)} />)}
        </MapContainer>

        <div className="absolute left-5 top-5 z-[800] flex flex-wrap gap-2 rounded-xl border border-white/70 bg-white/95 p-2 shadow-lg backdrop-blur">
          {(Object.keys(LAYER_CONFIG) as DiagnosticLayer[]).map((layer) => (
            <button
              key={layer}
              onClick={() => setActiveLayer(layer)}
              className={`rounded-lg px-3 py-2 text-[12px] font-bold transition ${activeLayer === layer ? "text-white" : "text-[#0F2A3D] hover:bg-[#eef2f4]"}`}
              style={activeLayer === layer ? { background: LAYER_CONFIG[layer].color } : undefined}
            >
              {LAYER_CONFIG[layer].shortLabel}
            </button>
          ))}
          <button
            onClick={() => setShowDistrictLabels((value) => !value)}
            className={`rounded-lg px-3 py-2 text-[12px] font-bold transition ${showDistrictLabels ? "bg-[#0F2A3D] text-white" : "text-[#0F2A3D] hover:bg-[#eef2f4]"}`}
          >
            District Names
          </button>
        </div>

        <div className="absolute bottom-5 left-5 z-[800] w-[250px] rounded-xl border border-white/70 bg-white/95 p-4 shadow-lg backdrop-blur">
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#0F2A3D]">{LAYER_CONFIG[activeLayer].label}</p>
          <div className="space-y-2">
            {LEGEND_BINS.map((bin) => (
              <div key={bin.label} className="flex items-center gap-2 text-[12px] text-[#0F2A3D]">
                <span className="h-3 w-5 rounded-sm border border-black/10" style={{ background: bin.color }} />
                <span className="font-semibold">{bin.min}% - {bin.max}%</span>
                <span className="text-[#64748b]">{bin.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-[#e2e8f0] pt-3 text-[11px] text-[#64748b]">
            <Database className="h-3.5 w-3.5" />
            {dbHealth ? `${dbHealth.grid_cell_count} grid cells indexed` : `${gridGeo?.features.length || 0} cells loaded`}
          </div>
        </div>

        {hoveredGrid && (
          <div className="absolute right-5 top-5 z-[800] rounded-xl bg-[#0F2A3D]/90 px-4 py-3 text-sm font-semibold text-white backdrop-blur">
            Grid {hoveredGrid.grid_id} | {percent(probabilityForLayer(hoveredGrid as any, activeLayer))}
          </div>
        )}

        {selectedPlace && (
          <div className="absolute right-5 top-20 z-[800] w-[320px] rounded-xl border border-white/70 bg-white/95 p-4 shadow-lg backdrop-blur">
            <button onClick={() => setSelectedPlace(null)} className="absolute right-3 top-3 rounded-md p-1 hover:bg-[#eef2f4]">
              <X className="h-4 w-4 text-[#64748b]" />
            </button>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#64748b]">Selected Place</p>
            <h2 className="mt-1 text-[17px] font-extrabold text-[#0F2A3D]">{selectedPlace.location_name}</h2>
            <p className="mt-1 text-sm text-[#64748b]">{selectedPlace.traditional_authority || "Unknown TA"} | {selectedPlace.district || "Unknown district"}</p>
            <p className="mt-3 rounded-lg bg-[#f8fafb] p-3 text-[12px] font-semibold text-[#0F2A3D]">
              {selectedPlace.latitude.toFixed(4)}, {selectedPlace.longitude.toFixed(4)}
            </p>
          </div>
        )}

        {selectedGrid && (
          <div className="absolute bottom-5 left-1/2 z-[800] w-[520px] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl border border-white/70 bg-white/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#64748b]">Active Grid Cell</p>
                <h2 className="mt-1 text-[20px] font-extrabold text-[#0F2A3D]">{selectedGrid.grid}</h2>
                <p className="text-[13px] text-[#64748b]">{selectedGrid.district} District | {selectedGrid.gridData?.latitude.toFixed(4)}, {selectedGrid.gridData?.longitude.toFixed(4)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Onset", percent(selectedGrid.gridData?.onset_probability)],
                ["False-Onset", percent(selectedGrid.gridData?.false_onset_probability)],
                ["Dry Spell", percent(selectedGrid.gridData?.dry_spell_probability)],
                ["Median Onset", dateOnly(selectedGrid.gridData?.first_detected_onset_date)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafb] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748b]">{label}</p>
                  <p className="mt-1 text-[15px] font-extrabold text-[#0F2A3D]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="absolute right-5 bottom-5 z-[800] flex flex-col gap-2">
          {[
            { icon: <Plus className="h-5 w-5" />, label: "Zoom In", action: zoomIn },
            { icon: <Minus className="h-5 w-5" />, label: "Zoom Out", action: zoomOut },
            { icon: <Layers className="h-5 w-5" />, label: "Basemap", action: cycleLayer },
            { icon: <Navigation2 className="h-5 w-5" />, label: "Recenter", action: recenter },
          ].map((item) => (
            <button key={item.label} onClick={item.action} title={item.label} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#0F2A3D] shadow-lg hover:bg-[#eef2f4]">
              {item.icon}
            </button>
          ))}
        </div>
      </div>

      {selectedGrid && (
        <div className="mt-5 grid gap-5 xl:grid-cols-3">
          <GridGraph location={selectedGrid} metricType="onset" />
          <GridGraph location={selectedGrid} metricType="false_onset" />
          <GridGraph location={selectedGrid} metricType="dry_spell" />
        </div>
      )}
    </>
  )
}
