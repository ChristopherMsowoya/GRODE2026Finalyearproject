"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import { Database, Loader2 } from "lucide-react"
import {
  fetchBoundaries,
  fetchDatabaseHealth,
  fetchGridDiagnostics,
  type DatabaseHealthResponse,
  type DiagnosticLayer,
  type GeoJsonFeatureCollection,
} from "@/lib/algorithm-api"
import LocationSelector, { type SelectedLocation } from "@/components/location-selector"

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

function pulseMarkerHtml() {
  return `
    <div class="gps-pulse-marker">
      <span class="gps-pulse-ring"></span>
      <span class="gps-pulse-dot"></span>
    </div>
  `
}

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const gridLayerRef = useRef<any>(null)
  const countryLayerRef = useRef<any>(null)
  const districtLayerRef = useRef<any>(null)
  const legendRef = useRef<any>(null)
  const selectedLayerRef = useRef<any>(null)
  const locationMarkerRef = useRef<any>(null)
  const selectedGridIdRef = useRef<string | null>(null)
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
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null)

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
      const activeDistrict = selectedLocation?.district || "Lilongwe"
      setDataLoading(true)
      try {
        const [health, country, districts, grid] = await Promise.all([
          fetchDatabaseHealth(),
          fetchBoundaries("country", true),
          fetchBoundaries("districts", true),
          fetchGridDiagnostics({ limit: 2500, source_grid: "esri_5km_v1", district: activeDistrict }),
        ])
        if (cancelled) return
        setDbHealth(health)
        setCountryGeo(country)
        setDistrictGeo(districts)
        setGridGeo(grid)
        const firstGrid = grid.features[0]?.properties as { grid_id?: string } | undefined
        if (firstGrid?.grid_id) {
          selectedGridIdRef.current = firstGrid.grid_id
        }
      } catch (error) {
        if (!cancelled) setDataError(error instanceof Error ? error.message : "Failed to load grid diagnostics.")
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    }
    void loadMapData()
    return () => { cancelled = true }
  }, [isClient, selectedLocation?.district])

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
    const gridId = String(selectedLocation?.grid || "")
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
      matchedLayer.setStyle(gridStyle(props, activeLayer, props.grid_id))
    }
  }, [activeLayer, selectedLocation])

  useEffect(() => {
    if (!leaflet || !map.current || !selectedLocation?.gridData) return

    const latitude = Number(selectedLocation.gridData.area_latitude ?? selectedLocation.gridData.latitude)
    const longitude = Number(selectedLocation.gridData.area_longitude ?? selectedLocation.gridData.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) return

    locationMarkerRef.current?.remove()
    const icon = leaflet.divIcon({
      className: "",
      html: pulseMarkerHtml(),
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })
    locationMarkerRef.current = leaflet
      .marker([latitude, longitude], { icon })
      .addTo(map.current)
      .bindTooltip(selectedLocation.areaName || selectedLocation.gridData.area_name || "Selected area", {
        direction: "top",
        offset: [0, -12],
        opacity: 0.95,
      })

    map.current.panTo([latitude, longitude], { animate: true })
  }, [leaflet, selectedLocation])

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
        .gps-pulse-marker {
          position: relative;
          width: 24px;
          height: 24px;
        }
        .gps-pulse-dot {
          position: absolute;
          left: 8px;
          top: 8px;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #D64545;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 8px rgba(15, 42, 61, 0.25);
        }
        .gps-pulse-ring {
          position: absolute;
          left: 2px;
          top: 2px;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          background: rgba(214, 69, 69, 0.28);
          animation: gpsPulse 1.25s ease-out infinite;
        }
        @keyframes gpsPulse {
          0% { transform: scale(0.65); opacity: 0.95; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>

      <div className="mb-4 rounded-xl border border-[#d8dee4] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-[24px] font-extrabold leading-tight text-[#0F2A3D] sm:text-[28px]">Grid-Level Rainfall Diagnostics</h1>
            <p className="mt-1 text-[14px] leading-relaxed text-[#64748b]">
              5km computational grid cells carry the rainfall probabilities. Districts are reference overlays only.
            </p>
          </div>
          <div className="w-full xl:max-w-[760px]">
            <LocationSelector onLocationChange={setSelectedLocation} />
          </div>
        </div>
      </div>

      {dataError && <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm font-medium text-[#b91c1c]">{dataError}</div>}

      <div className="relative h-[68vh] min-h-[430px] overflow-hidden rounded-xl border border-[#d8dee4] bg-white md:h-[calc(100vh-11rem)] md:min-h-[600px]">
        {dataLoading && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#0F2A3D]" />
              <p className="text-[13px] font-medium text-[#6b7a8d]">Loading grid diagnostics...</p>
            </div>
          </div>
        )}

        <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

        <div className="absolute left-3 top-3 z-[800] flex max-w-[calc(100%-1.5rem)] gap-1 overflow-x-auto rounded-xl border border-white/70 bg-white/95 p-1.5 shadow-lg backdrop-blur sm:left-5 sm:top-5">
          {(Object.keys(LAYER_CONFIG) as DiagnosticLayer[]).map((layer) => (
            <button
              key={layer}
              onClick={() => setActiveLayer(layer)}
              className={`shrink-0 rounded-lg px-3 py-2 text-[12px] font-bold transition-all ${activeLayer === layer ? "text-white shadow-sm" : "text-[#0F2A3D] hover:bg-[#eef2f4]"}`}
              style={activeLayer === layer ? { background: LAYER_CONFIG[layer].color } : undefined}
            >
              {LAYER_CONFIG[layer].shortLabel}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowDistrictLabels((value) => !value)}
          className={`absolute right-3 top-[64px] z-[800] rounded-lg border border-white/70 px-3 py-2 text-[12px] font-bold shadow-lg transition-all sm:right-16 sm:top-5 ${showDistrictLabels ? "bg-[#0F2A3D] text-white" : "bg-white/95 text-[#0F2A3D]"}`}
        >
          {showDistrictLabels ? "Hide Names" : "Show Names"}
        </button>

        <div className="absolute bottom-3 right-3 z-[800] flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-xl border border-white/70 bg-white/95 px-3 py-2 text-[11px] text-[#64748b] shadow-lg sm:bottom-5 sm:right-5 sm:text-[12px]">
          <Database className="h-3.5 w-3.5" />
          {dbHealth ? `${dbHealth.grid_cell_count} grid cells indexed` : `${gridGeo?.features.length || 0} cells loaded`}
        </div>

      </div>
    </>
  )
}
