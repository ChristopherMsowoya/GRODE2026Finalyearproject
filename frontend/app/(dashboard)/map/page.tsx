"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import { Database, Eye, EyeOff, Loader2, Move, Search } from "lucide-react"
import {
  fetchBoundaries,
  fetchDatabaseHealth,
  fetchGridDiagnostics,
  searchGridLocations,
  type DatabaseHealthResponse,
  type DiagnosticLayer,
  type GeoJsonFeatureCollection,
  type GridDiagnosticProperties,
} from "@/lib/algorithm-api"

const LAYER_CONFIG: Record<DiagnosticLayer, { label: string; shortLabel: string; color: string }> = {
  onset: { label: "Onset Probability", shortLabel: "Onset", color: "#1F7A63" },
  false_onset: { label: "False-Onset Probability", shortLabel: "False-Onset", color: "#D64545" },
  dry_spell: { label: "Dry Spell Probability", shortLabel: "Dry Spell", color: "#2563eb" },
}

function getColorForLayer(prob: number, layer: DiagnosticLayer): string {
  if (layer === "onset") {
    if (prob > 0.60) return "#1F7A63"
    if (prob > 0.30) return "#facc15"
    return "#e36a6a"
  }
  if (prob > 0.60) return "#e36a6a"
  if (prob > 0.30) return "#facc15"
  return "#1F7A63"
}

function percent(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "-"
}

function probabilityForLayer(props: Record<string, any>, layer: DiagnosticLayer) {
  if (layer === "false_onset") return Number(props.false_onset_probability ?? 0)
  if (layer === "dry_spell") return Number(props.dry_spell_probability ?? 0)
  return Number(props.onset_probability ?? 0)
}

function gridStyle(props: Record<string, any>, layer: DiagnosticLayer, selectedGridId: string | null) {
  const isSelected = selectedGridId === props.grid_id
  return {
    fillColor: getColorForLayer(probabilityForLayer(props, layer), layer),
    color: isSelected ? "#ffffff" : "#334155",
    weight: isSelected ? 1.8 : 0.28,
    opacity: isSelected ? 1 : 0.5,
    fillOpacity: isSelected ? 0.92 : 0.68,
  }
}

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const gridLayerRef = useRef<any>(null)
  const countryLayerRef = useRef<any>(null)
  const districtLayerRef = useRef<any>(null)
  const legendRef = useRef<any>(null)
  const selectedLayerRef = useRef<any>(null)
  const selectedGridIdRef = useRef<string | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const [leaflet, setLeaflet] = useState<any>(null)

  const [activeLayer, setActiveLayer] = useState<DiagnosticLayer>("onset")
  const [isClient, setIsClient] = useState(false)
  const [gridGeo, setGridGeo] = useState<GeoJsonFeatureCollection | null>(null)
  const [countryGeo, setCountryGeo] = useState<GeoJsonFeatureCollection | null>(null)
  const [districtGeo, setDistrictGeo] = useState<GeoJsonFeatureCollection | null>(null)

  const [showDistrictLabels, setShowDistrictLabels] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [dbHealth, setDbHealth] = useState<DatabaseHealthResponse | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [selectedGridInfo, setSelectedGridInfo] = useState<GridDiagnosticProperties | null>(null)
  const [showSelectedPanel, setShowSelectedPanel] = useState(true)
  const [panelPosition, setPanelPosition] = useState({ x: 20, y: 92 })
  const [draggingPanel, setDraggingPanel] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [searchText, setSearchText] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => { setIsClient(true) }, [])

  useEffect(() => {
    if (!isClient) return
    let cancelled = false
    import("leaflet").then((module) => {
      if (!cancelled) setLeaflet(module.default)
    })
    return () => { cancelled = true }
  }, [isClient])

  useEffect(() => {
    if (!isClient || !leaflet || !mapContainer.current || map.current) return
    map.current = leaflet.map(mapContainer.current, {
      center: [-13.5, 34.2],
      zoom: 7,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    })
    leaflet.control.zoom({ position: "topright" }).addTo(map.current)
  }, [isClient, leaflet])

  useEffect(() => {
    if (!isClient) return
    let cancelled = false
    async function loadMapData() {
      setDataLoading(true)
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
        if (firstGrid?.grid_id) {
          selectedGridIdRef.current = firstGrid.grid_id
          setSelectedGridInfo(firstGrid)
        }
      } catch (error) {
        if (!cancelled) setDataError(error instanceof Error ? error.message : "Failed to load grid diagnostics.")
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    }
    void loadMapData()
    return () => { cancelled = true }
  }, [isClient])

  useEffect(() => {
    if (!isClient || !leaflet || !map.current) return
    gridLayerRef.current?.remove()
    countryLayerRef.current?.remove()
    districtLayerRef.current?.remove()
    legendRef.current?.remove()
    selectedLayerRef.current = null

    if (!countryGeo || !districtGeo || !gridGeo) return

    const selectLayer = (layer: any, props: any, openPopup = false) => {
      if (selectedLayerRef.current && selectedLayerRef.current !== layer) {
        gridLayerRef.current?.resetStyle(selectedLayerRef.current)
      }
      selectedLayerRef.current = layer
      selectedGridIdRef.current = props.grid_id
      setSelectedGridInfo(props)
      layer.setStyle(gridStyle(props, activeLayer, props.grid_id))
      if (openPopup) layer.openPopup()
    }

    gridLayerRef.current = leaflet.geoJSON(gridGeo as any, {
      renderer: leaflet.canvas({ padding: 0.35 }),
      style: (feature: any) => {
        const props = (feature?.properties || {}) as any
        return gridStyle(props, activeLayer, selectedGridIdRef.current)
      },
      onEachFeature: (feature: any, layer: any) => {
        const props = feature.properties || {}
        const prob = probabilityForLayer(props, activeLayer)
        layer.bindTooltip(`Grid ${props.grid_id}: ${percent(prob)}`, { sticky: true })
        layer.bindPopup(`
          <div style="font-family:Inter,sans-serif;min-width:220px;color:#0f2a3d">
            <strong>Grid: ${props.grid_id}</strong><br/>
            <span style="color:#64748b">District:</span> <strong>${props.district_name || "Unknown"}</strong><br/>
            <span style="color:#64748b">Onset Probability:</span> ${percent(props.onset_probability)}<br/>
            <span style="color:#64748b">False Onset Probability:</span> ${percent(props.false_onset_probability)}<br/>
            <span style="color:#64748b">Dry Spell Probability:</span> ${percent(props.dry_spell_probability)}
          </div>
        `)
        layer.on({
          mouseover: (event: any) => { event.target.setStyle({ weight: 1.6, fillOpacity: 0.95 }) },
          mouseout: (event: any) => { gridLayerRef.current?.resetStyle(event.target) },
          click: () => {
            selectLayer(layer, props)
          },
        })
      },
    }).addTo(map.current)

    districtLayerRef.current = leaflet.geoJSON(districtGeo as any, {
      style: { color: "#111827", weight: 1.1, fillOpacity: 0, opacity: 0.85, dashArray: "3,4" },
      interactive: false,
      onEachFeature: (feature: any, layer: any) => {
        const distName = feature.properties?.DISTRICT || feature.properties?.shapeName || feature.properties?.name || "District"
        if (showDistrictLabels) layer.bindTooltip(distName, { permanent: true, direction: "center", className: "district-map-label" })
      },
    }).addTo(map.current)

    countryLayerRef.current = leaflet.geoJSON(countryGeo as any, {
      style: { color: "#0b3a4a", weight: 2.8, fillOpacity: 0 },
      interactive: false,
    }).addTo(map.current)

    legendRef.current = (leaflet.control as any)({ position: "bottomleft" })
    legendRef.current!.onAdd = () => {
      const div = leaflet.DomUtil.create("div")
      div.style.cssText = "background:white;padding:10px 14px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.12);font-family:Inter,sans-serif;font-size:11px;min-width:130px;"
      div.innerHTML = `
        <p style="margin:0 0 7px 0;font-weight:800;color:#0d2f3f;text-transform:uppercase;letter-spacing:.06em;font-size:10px;">${LAYER_CONFIG[activeLayer].label}</p>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;"><span style="width:16px;height:10px;border-radius:2px;background:#1F7A63;display:inline-block;"></span><span style="color:#0d2f3f;font-weight:600;">Low risk</span></div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;"><span style="width:16px;height:10px;border-radius:2px;background:#facc15;display:inline-block;"></span><span style="color:#0d2f3f;font-weight:600;">Moderate risk</span></div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="width:16px;height:10px;border-radius:2px;background:#e36a6a;display:inline-block;"></span><span style="color:#0d2f3f;font-weight:600;">High risk</span></div>
      `
      return div
    }
    legendRef.current!.addTo(map.current)
  }, [isClient, leaflet, countryGeo, districtGeo, gridGeo, activeLayer, showDistrictLabels])

  useEffect(() => {
    if (searchText.trim().length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      searchAbortRef.current?.abort()
      return
    }

    const controller = new AbortController()
    searchAbortRef.current?.abort()
    searchAbortRef.current = controller
    const timer = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const response = await searchGridLocations(searchText, 8, controller.signal)
        if (!controller.signal.aborted) setSearchResults(response.locations || [])
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false)
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [searchText])

  const selectSearchResult = (result: any) => {
    setSearchText(result.location_name || "")
    setSearchResults([])
    const gridId = String(result.grid_id || "")
    if (!gridId || !gridLayerRef.current || !map.current) return

    let matchedLayer: any = null
    gridLayerRef.current.eachLayer((layer: any) => {
      if (String(layer.feature?.properties?.grid_id) === gridId) matchedLayer = layer
    })

    if (matchedLayer) {
      const props = matchedLayer.feature.properties
      if (selectedLayerRef.current && selectedLayerRef.current !== matchedLayer) {
        gridLayerRef.current?.resetStyle(selectedLayerRef.current)
      }
      selectedLayerRef.current = matchedLayer
      selectedGridIdRef.current = props.grid_id
      setSelectedGridInfo({ ...props, area_name: result.location_name })
      matchedLayer.setStyle(gridStyle(props, activeLayer, props.grid_id))
      map.current.fitBounds(matchedLayer.getBounds(), { maxZoom: 11, padding: [28, 28] })
      matchedLayer.openPopup()
    } else if (result.latitude && result.longitude) {
      map.current.setView([result.latitude, result.longitude], 11)
    }
  }

  const beginPanelDrag = (event: any) => {
    setDraggingPanel(true)
    setDragOffset({ x: event.clientX - panelPosition.x, y: event.clientY - panelPosition.y })
  }

  useEffect(() => {
    if (!draggingPanel) return
    const onMove = (event: MouseEvent) => {
      setPanelPosition({
        x: Math.max(8, event.clientX - dragOffset.x),
        y: Math.max(8, event.clientY - dragOffset.y),
      })
    }
    const onUp = () => setDraggingPanel(false)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [dragOffset.x, dragOffset.y, draggingPanel])

  return (
    <>
      <style>{`
        .leaflet-container { background: #e6eef2 !important; font-family: Inter, sans-serif; }
        .leaflet-control-attribution { display: none !important; }
        .leaflet-top.leaflet-right { top: 1rem; right: 0.75rem; }
        .district-map-label {
          border: 0; border-radius: 999px;
          background: rgba(15, 42, 61, 0.78);
          color: white; font-family: Inter, sans-serif;
          font-size: 10px; font-weight: 800; letter-spacing: 0.04em;
          box-shadow: 0 1px 8px rgba(15,42,61,0.18); padding: 2px 7px;
        }
      `}</style>

      <div className="mb-4 rounded-xl border border-[#d8dee4] bg-white p-5">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight text-[#0F2A3D]">Grid-Level Rainfall Diagnostics</h1>
          <p className="mt-1 text-[14px] leading-relaxed text-[#64748b]">
            5km computational grid cells carry the rainfall probabilities. Districts are reference overlays only.
          </p>
        </div>
      </div>

      {dataError && <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm font-medium text-[#b91c1c]">{dataError}</div>}

      <div className="relative overflow-hidden rounded-xl border border-[#d8dee4] bg-white" style={{ height: "calc(100vh - 11rem)", minHeight: 600 }}>
        {dataLoading && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#0F2A3D]" />
              <p className="text-[13px] font-medium text-[#6b7a8d]">Loading grid diagnostics...</p>
            </div>
          </div>
        )}

        <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

        <div className="absolute left-5 top-5 z-[820] w-[320px] max-w-[calc(100%-2.5rem)]">
          <div className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
            <Search className="h-4 w-4 text-[#64748b]" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search district, TA, or area"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#0F2A3D] outline-none placeholder:text-[#94a3b8]"
            />
            {searchLoading && <Loader2 className="h-4 w-4 animate-spin text-[#64748b]" />}
          </div>
          {searchResults.length > 0 && (
            <div className="mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[#e2e8f0] bg-white p-1.5 shadow-xl">
              {searchResults.map((result, index) => (
                <button
                  key={`${result.grid_id}-${result.location_name}-${index}`}
                  onClick={() => selectSearchResult(result)}
                  className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#f8fafc]"
                >
                  <span className="block text-[13px] font-bold text-[#0F2A3D]">{result.location_name}</span>
                  <span className="block text-[11px] font-semibold text-[#64748b]">
                    {result.place_type} - Grid {result.grid_id}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="absolute left-5 top-[4.9rem] z-[800] flex gap-1 rounded-xl border border-white/70 bg-white/95 p-1.5 shadow-lg backdrop-blur">
          {(Object.keys(LAYER_CONFIG) as DiagnosticLayer[]).map((layer) => (
            <button
              key={layer}
              onClick={() => setActiveLayer(layer)}
              className={`rounded-lg px-3 py-2 text-[12px] font-bold transition-all ${activeLayer === layer ? "text-white shadow-sm" : "text-[#0F2A3D] hover:bg-[#eef2f4]"}`}
              style={activeLayer === layer ? { background: LAYER_CONFIG[layer].color } : undefined}
            >
              {LAYER_CONFIG[layer].shortLabel}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowDistrictLabels((value) => !value)}
          className={`absolute right-16 top-5 z-[800] rounded-lg border border-white/70 px-3 py-2 text-[12px] font-bold shadow-lg transition-all ${showDistrictLabels ? "bg-[#0F2A3D] text-white" : "bg-white/95 text-[#0F2A3D]"}`}
        >
          {showDistrictLabels ? "Hide Names" : "Show Names"}
        </button>

        {selectedGridInfo && (
          <>
            <button
              onClick={() => setShowSelectedPanel((value) => !value)}
              className="absolute right-16 top-16 z-[800] flex items-center gap-1.5 rounded-lg border border-white/70 bg-white/95 px-3 py-2 text-[12px] font-bold text-[#0F2A3D] shadow-lg"
            >
              {showSelectedPanel ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showSelectedPanel ? "Hide Grid" : "Show Grid"}
            </button>
            {showSelectedPanel && (
              <div
                className="absolute z-[810] w-[240px] rounded-xl border border-white/70 bg-white/95 p-3 shadow-xl backdrop-blur"
                style={{ left: panelPosition.x, top: panelPosition.y }}
              >
                <button
                  onMouseDown={beginPanelDrag}
                  className="mb-2 flex w-full cursor-move items-center justify-between rounded-lg bg-[#f8fafc] px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748b]"
                >
                  Active Grid
                  <Move className="h-3.5 w-3.5" />
                </button>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748b]">Grid Number</p>
                    <p className="text-[16px] font-extrabold text-[#0F2A3D]">{selectedGridInfo.grid_id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748b]">Selected/Search Area</p>
                    <p className="text-[13px] font-bold text-[#0F2A3D]">{selectedGridInfo.area_name || selectedGridInfo.district_name || "Grid cell"}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="absolute bottom-5 right-5 z-[800] flex items-center gap-2 rounded-xl border border-white/70 bg-white/95 px-3 py-2 shadow-lg text-[12px] text-[#64748b]">
          <Database className="h-3.5 w-3.5" />
          {dbHealth ? `${dbHealth.grid_cell_count} grid cells indexed` : `${gridGeo?.features.length || 0} cells loaded`}
        </div>

      </div>
    </>
  )
}
