"use client"

import { useState, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Plus, Minus, Layers, Navigation2, TrendingUp, X, History } from "lucide-react"
import type { Map as LeafletMap, Layer, PathOptions } from "leaflet"
import malawiDistricts from "@/lib/data/malawiDistricts.json"

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false })
const TileLayer    = dynamic(() => import("react-leaflet").then(m => m.TileLayer),    { ssr: false })
const GeoJSON      = dynamic(() => import("react-leaflet").then(m => m.GeoJSON),      { ssr: false })

interface DistrictProps {
  name:          string
  riskLevel:     "optimal" | "caution" | "alert"
  cropStress:    string
  soilMoisture:  number
  forecastOnset: string
}

const RISK_COLORS = {
  optimal: { fill: "#1F7A63", hover: "#17634f", stroke: "#eab308" },
  caution: { fill: "#d97706", hover: "#b45309", stroke: "#eab308" },
  alert:   { fill: "#D64545", hover: "#b53030", stroke: "#eab308" },
}

function getStyle(riskLevel: string, hovered = false): PathOptions {
  const c = RISK_COLORS[riskLevel as keyof typeof RISK_COLORS] || RISK_COLORS.optimal
  return { fillColor: hovered ? c.hover : c.fill, color: c.stroke, weight: hovered ? 2.5 : 1.5, opacity: 1, fillOpacity: hovered ? 0.78 : 0.60 }
}
function riskLabel(r: string) { return r === "optimal" ? "Optimal" : r === "caution" ? "Caution" : "Alert" }
function riskTextColor(r: string) { return r === "optimal" ? "#1F7A63" : r === "caution" ? "#d97706" : "#D64545" }

export default function MapPage() {
  const mapRef = useRef<LeafletMap | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictProps>({
    name: "Lilongwe Central", riskLevel: "optimal", cropStress: "Low", soilMoisture: 68, forecastOnset: "Nov 14",
  })
  const [hoveredName,  setHoveredName]  = useState<string | null>(null)
  const [cardVisible,  setCardVisible]  = useState(true)
  const [layerStyle,   setLayerStyle]   = useState<"terrain" | "satellite" | "street">("terrain")

  const TILES = {
    terrain:   { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",     attr: "© OpenTopoMap" },
    satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Esri" },
    street:    { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",   attr: "© OpenStreetMap" },
  }

  const onEachFeature = useCallback((feature: GeoJSON.Feature, layer: Layer) => {
    const props = feature.properties as DistrictProps
    layer.on({
      mouseover(e: { target: L.Path }) { setHoveredName(props.name); e.target.setStyle(getStyle(props.riskLevel, true)); e.target.bringToFront() },
      mouseout(e: { target: L.Path })  { setHoveredName(null); e.target.setStyle(getStyle(props.riskLevel, false)) },
      click() { setSelectedDistrict(props); setCardVisible(true) },
    })
  }, [])

  const featureStyle = useCallback((feature?: GeoJSON.Feature): PathOptions =>
    getStyle(feature?.properties?.riskLevel || "optimal"), [])

  const zoomIn   = () => mapRef.current?.zoomIn()
  const zoomOut  = () => mapRef.current?.zoomOut()
  const recenter = () => mapRef.current?.setView([-13.5, 34.2], 7)
  const cycleLayer = () => setLayerStyle(l => l === "terrain" ? "satellite" : l === "satellite" ? "street" : "terrain")
  const tile = TILES[layerStyle]

  return (
    <>
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .leaflet-container { background: #1a2e1a !important; }
        .leaflet-control-zoom { display: none !important; }
        .leaflet-control-attribution { display: none !important; }
      `}</style>

      {/* Title block above map */}
      <div className="mb-4 p-6 bg-white rounded-2xl border border-[#e2e8f0]">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight"
          style={{ color:"#0F2A3D" }}>
          Spatial Risk Assessment
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color:"#6b7a8d" }}>
          District monitoring for the agricultural season and rainfall detection.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl" style={{ height: "calc(100vh - 7.5rem)" }}>

        {/* Map */}
        <MapContainer center={[-13.5, 34.2]} zoom={7} style={{ height:"100%", width:"100%" }} zoomControl={false} ref={mapRef}>
          <TileLayer key={layerStyle} url={tile.url} attribution={tile.attr} />
          <GeoJSON key="districts" data={malawiDistricts as any} style={featureStyle} onEachFeature={onEachFeature} />
        </MapContainer>

        {/* Hovered tooltip */}
        {hoveredName && (
          <div className="absolute right-20 top-6 z-[800] rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background:"rgba(15,42,61,0.85)", backdropFilter:"blur(8px)" }}>
            📍 {hoveredName}
          </div>
        )}

        {/* Risk Legend (bottom-left) */}
        <div className="absolute bottom-6 left-6 z-[800] rounded-2xl p-4"
          style={{ background:"rgba(255,255,255,0.92)", backdropFilter:"blur(12px)", boxShadow:"0 8px 32px rgba(15,42,61,0.15)", border:"1px solid rgba(255,255,255,0.6)" }}>
          <h3 className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color:"#6b7a8d" }}>Risk Legend</h3>
          <div className="space-y-2.5">
            {[
              { color:"#1F7A63", label:"Safe / Optimal" },
              { color:"#d97706", label:"Caution / Monitoring" },
              { color:"#D64545", label:"High Risk / Alert" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2.5">
                <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background:color }} />
                <span className="text-[13px] font-medium" style={{ color:"#1a2332" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* District info card (bottom-center) */}
        {cardVisible && (
          <div className="absolute bottom-6 left-1/2 z-[800] -translate-x-1/2 w-[440px]"
            style={{ background:"rgba(255,255,255,0.95)", backdropFilter:"blur(16px)", borderRadius:"20px", boxShadow:"0 16px 48px rgba(15,42,61,0.22), 0 0 0 1px rgba(255,255,255,0.7)" }}>
            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-4 pb-3" style={{ borderBottom:"1px solid #e2e8f0" }}>
              <div>
                <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background:"#1F7A63" }}>
                  Active District
                </span>
                <h2 className="mt-1.5 text-[20px] font-extrabold leading-tight" style={{ color:"#0F2A3D" }}>
                  {selectedDistrict.name}
                </h2>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-right">
                  <span className="text-[28px] font-black leading-none" style={{ color:"#0F2A3D" }}>{selectedDistrict.forecastOnset}</span>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ color:"#6b7a8d" }}>Forecast Onset</p>
                </div>
                <button onClick={() => setCardVisible(false)} className="mt-0.5 rounded-full p-1 transition-colors hover:bg-gray-100">
                  <X className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 px-2 py-1" style={{ borderBottom:"1px solid #e2e8f0" }}>
              {[
                { label:"Crop Stress",   value:selectedDistrict.cropStress },
                { label:"Risk Level",    value:riskLabel(selectedDistrict.riskLevel), colored:riskTextColor(selectedDistrict.riskLevel) },
              ].map(({ label, value, colored }) => (
                <div key={label} className="px-3 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color:"#6b7a8d" }}>{label}</span>
                  <p className="mt-1 text-[15px] font-extrabold" style={{ color:colored || "#0F2A3D" }}>{value}</p>
                </div>
              ))}
            </div>

            {/* CTA — View Historical Trends → /map/historical */}
            <div className="px-4 py-3">
              <Link
                href="/map/historical"
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13.5px] font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                style={{ background:"linear-gradient(135deg, #0F2A3D 0%, #1a3d54 100%)" }}
              >
                <History className="h-4 w-4" />
                View Historical Trends
                <TrendingUp className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Show card again if dismissed */}
        {!cardVisible && (
          <button onClick={() => setCardVisible(true)}
            className="absolute bottom-6 left-1/2 z-[800] -translate-x-1/2 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white transition-all hover:opacity-90"
            style={{ background:"rgba(15,42,61,0.85)", backdropFilter:"blur(8px)" }}>
            📊 Show District Info
          </button>
        )}

        {/* Right map controls */}
        <div className="absolute right-5 bottom-6 z-[800] flex flex-col gap-2">
          {[
            { icon:<Plus  className="h-5 w-5" />, tooltip:"Zoom In",     action:zoomIn    },
            { icon:<Minus className="h-5 w-5" />, tooltip:"Zoom Out",    action:zoomOut   },
            { icon:<Layers className="h-5 w-5"/>, tooltip:"Layer Style", action:cycleLayer },
            { icon:<Navigation2 className="h-5 w-5" />, tooltip:"Recenter", action:recenter },
          ].map(({ icon, tooltip, action }) => (
            <button key={tooltip} onClick={action} title={tooltip}
              className="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ background:"rgba(255,255,255,0.95)", backdropFilter:"blur(10px)", boxShadow:"0 4px 16px rgba(15,42,61,0.15)", color:"#0F2A3D" }}>
              {icon}
            </button>
          ))}
        </div>

        {/* Layer style badge */}
        <div className="absolute right-5 top-6 z-[800] rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider"
          style={{ background:"rgba(255,255,255,0.9)", backdropFilter:"blur(8px)", color:"#0F2A3D", boxShadow:"0 2px 8px rgba(15,42,61,0.1)" }}>
          {layerStyle === "terrain" ? "🗻 Terrain" : layerStyle === "satellite" ? "🛰️ Satellite" : "🗺️ Street"}
        </div>
      </div>
    </>
  )
}
