"use client"

import { useEffect, useMemo, useRef, useCallback, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Plus, Minus, Layers, Navigation2, TrendingUp, X, History, Search, Loader2, MapPin, Database } from "lucide-react"
import type { Map as LeafletMap, Layer, PathOptions } from "leaflet"
import malawiDistricts from "@/lib/data/malawiDistricts.json"
import {
  fetchDatabaseHealth,
  fetchTraditionalAuthorityGridCounts,
  fetchDistrictSummary,
  searchLocations,
  type DatabaseHealthResponse,
  type LocationSearchResult,
  type TraditionalAuthorityGridCount,
  type DistrictSummary
} from "@/lib/algorithm-api"

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
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([])
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null)
  const [taCounts, setTaCounts] = useState<TraditionalAuthorityGridCount[]>([])
  const [dbHealth, setDbHealth] = useState<DatabaseHealthResponse | null>(null)
  const [liveDistricts, setLiveDistricts] = useState<Record<string, DistrictSummary>>({})
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)


  const TILES = {
    terrain:   { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",     attr: "© OpenTopoMap" },
    satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Esri" },
    street:    { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",   attr: "© OpenStreetMap" },
  }

  const getRiskLevelForDistrict = useCallback((name: string) => {
     if (!name || Object.keys(liveDistricts).length === 0) return "optimal"
     const d = liveDistricts[name]
     if (!d) return "optimal"
     return d.overall_risk_level === 'High' ? 'alert' : d.overall_risk_level === 'Medium' ? 'caution' : 'optimal'
  }, [liveDistricts])

  const onEachFeature = useCallback((feature: GeoJSON.Feature, layer: Layer) => {
    const name = feature.properties?.shapeName as string
    layer.on({
      mouseover(e: { target: L.Path }) { setHoveredName(name); e.target.setStyle(getStyle(getRiskLevelForDistrict(name), true)); e.target.bringToFront() },
      mouseout(e: { target: L.Path })  { setHoveredName(null); e.target.setStyle(getStyle(getRiskLevelForDistrict(name), false)) },
      click() { 
        const d = liveDistricts[name]
        const riskLevel = getRiskLevelForDistrict(name)
        const cropStress = d ? `${(d.average_crop_stress_probability * 100).toFixed(0)}%` : 'Low'
        const forecastOnset = d?.first_detected_onset_date ? new Date(d.first_detected_onset_date).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'Pending'
        setSelectedDistrict({ name, riskLevel, cropStress, soilMoisture: 68, forecastOnset })
        setCardVisible(true) 
      },
    })
  }, [getRiskLevelForDistrict, liveDistricts])

  const featureStyle = useCallback((feature?: GeoJSON.Feature): PathOptions => {
    const name = feature?.properties?.shapeName as string
    return getStyle(getRiskLevelForDistrict(name))
  }, [getRiskLevelForDistrict])

  const zoomIn   = () => mapRef.current?.zoomIn()
  const zoomOut  = () => mapRef.current?.zoomOut()
  const recenter = () => mapRef.current?.setView([-13.5, 34.2], 7)
  const cycleLayer = () => setLayerStyle(l => l === "terrain" ? "satellite" : l === "satellite" ? "street" : "terrain")
  const tile = TILES[layerStyle]
  const topTaCounts = useMemo(
    () => [...taCounts].sort((a, b) => b.grid_cell_count - a.grid_cell_count).slice(0, 6),
    [taCounts]
  )

  useEffect(() => {
    let cancelled = false

    async function loadDashboardData() {
      try {
        const [health, taCountResponse, ds] = await Promise.all([
          fetchDatabaseHealth(),
          fetchTraditionalAuthorityGridCounts(),
          fetchDistrictSummary()
        ])

        if (cancelled) return

        setDbHealth(health)
        setTaCounts(taCountResponse.traditional_authorities)
        
        const distMap: Record<string, DistrictSummary> = {}
        ds.districts.forEach(d => distMap[d.district] = d)
        setLiveDistricts(distMap)
      } catch (error) {
        if (!cancelled) {
          setDataError(error instanceof Error ? error.message : "Failed to load map intelligence data.")
        }
      }
    }

    loadDashboardData()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSearch() {
    const trimmed = query.trim()
    if (trimmed.length < 2) return

    setSearchLoading(true)
    setSearchError(null)

    try {
      const response = await searchLocations(trimmed, 8)
      setSearchResults(response.locations)
      setSelectedLocation(response.locations[0] ?? null)

      if (response.locations[0] && mapRef.current) {
        mapRef.current.setView([response.locations[0].latitude, response.locations[0].longitude], 11)
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Search failed.")
      setSearchResults([])
      setSelectedLocation(null)
    } finally {
      setSearchLoading(false)
    }
  }

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
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight" style={{ color:"#0F2A3D" }}>
              Spatial Risk Assessment
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color:"#6b7a8d" }}>
              Search named places, identify their exact 5km grid cell, and inspect Traditional Authority grid coverage.
            </p>
          </div>

          <div className="min-w-0 xl:w-[460px] relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7a8d]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleSearch()
                    }
                  }}
                  placeholder="Search a place like Malosa"
                  className="w-full rounded-xl border border-[#d8dee4] bg-[#f8fafb] py-3 pl-10 pr-3 text-sm outline-none transition focus:border-[#0F2A3D]"
                />
              </div>
              <button
                onClick={() => void handleSearch()}
                disabled={searchLoading || query.trim().length < 2}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F2A3D] px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50"
              >
                {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Find
              </button>
            </div>

            {searchError && (
              <p className="mt-2 text-sm text-[#D64545]">{searchError}</p>
            )}

            {/* Dropdown Search Results */}
            {searchResults.length > 1 && (
              <div 
                className="absolute top-14 left-0 z-[1000] w-full mt-1 bg-white border border-[#e2e8f0] shadow-xl rounded-xl p-2 max-h-60 overflow-y-auto"
              >
                <div className="space-y-1">
                  {searchResults.map((row) => (
                    <button
                      key={`${row.location_name}-${row.longitude}-${row.latitude}`}
                      onClick={() => {
                        setSelectedLocation(row)
                        setSearchResults([])
                        setQuery("")
                        mapRef.current?.setView([row.latitude, row.longitude], 11)
                      }}
                      className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left hover:bg-[#f0f4f8]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[#0F2A3D]">{row.location_name}</p>
                        <p className="truncate text-[11px] text-[#6b7a8d]">
                          {row.traditional_authority || "Unknown TA"} • {row.district || "Unknown district"}
                        </p>
                      </div>
                      <MapPin className="h-4 w-4 flex-shrink-0 text-[#1F7A63]" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedLocation && (
              <div className="mt-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafb] p-4 relative">
                <button 
                  onClick={() => setSelectedLocation(null)}
                  className="absolute top-3 right-3 text-[#6b7a8d] hover:text-[#0F2A3D]"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-start justify-between gap-4 pr-6">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7a8d]">Selected Place</p>
                    <h2 className="mt-1 text-[18px] font-extrabold text-[#0F2A3D]">{selectedLocation.location_name}</h2>
                    <p className="mt-1 text-sm text-[#6b7a8d]">
                      {selectedLocation.traditional_authority || "Unknown TA"} • {selectedLocation.district || "Unknown district"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-white p-3 border border-[#e9edf1]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">Coordinates</p>
                    <p className="mt-1 font-semibold text-[#0F2A3D]">
                      {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3 border border-[#e9edf1]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">5km Grid Cell</p>
                    <p className="mt-1 font-semibold text-[#0F2A3D]">
                      {selectedLocation.grid_id || "Unknown"}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-xl bg-white p-3 border border-[#e9edf1]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a8d]">TA Grid Coverage</p>
                    <p className="mt-1 font-semibold text-[#0F2A3D]">
                      {selectedLocation.traditional_authority 
                        ? `${taCounts.find(ta => ta.traditional_authority === selectedLocation.traditional_authority)?.grid_cell_count || 0} grid cells in ${selectedLocation.traditional_authority}`
                        : "TA coverage not available"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

            <div className="relative overflow-hidden rounded-2xl" style={{ height: "calc(100vh - 7.5rem)" }}>

        {/* Map */}
        <MapContainer center={[-13.5, 34.2]} zoom={7} style={{ height:"100%", width:"100%" }} zoomControl={false} ref={mapRef}>
          <TileLayer key={layerStyle} url={tile.url} attribution={tile.attr} />
          <GeoJSON key={`districts-${Object.keys(liveDistricts).length > 0}`} data={malawiDistricts as any} style={featureStyle} onEachFeature={onEachFeature} />
        </MapContainer>

        {/* Hovered tooltip */}
        {hoveredName && (
          <div className="absolute right-20 top-6 z-[800] rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background:"rgba(15,42,61,0.85)", backdropFilter:"blur(8px)" }}>
            📍 {hoveredName}
          </div>
        )}

        {/* Data Legend / Stats (bottom-left) */}
        <div className="absolute bottom-6 left-6 z-[800] w-72 rounded-2xl p-5"
          style={{ background:"rgba(255,255,255,0.95)", backdropFilter:"blur(16px)", boxShadow:"0 16px 48px rgba(15,42,61,0.22), 0 0 0 1px rgba(255,255,255,0.7)" }}>
          <div className="mb-4 flex items-center justify-between">
             <h3 className="text-sm font-extrabold text-[#0F2A3D]">Algorithm Intel</h3>
             {dbHealth && dbHealth.status === "ok" ? (
               <span className="flex items-center gap-1.5 rounded-full bg-[#E9F5EC] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1F7A63]">
                 <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1F7A63]"></div>
                 Live
               </span>
             ) : (
               <span className="flex items-center gap-1.5 rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#d97706]">
                  Connecting...
               </span>
             )}
          </div>

          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold text-[#6b7a8d]"><Database className="h-3.5 w-3.5" /> PostGIS Bounds</span>
                <span className="text-xs font-bold text-[#0F2A3D]">{dbHealth && dbHealth.grid_cell_count ? `${dbHealth.grid_cell_count.toLocaleString()}` : "..."}</span>
             </div>
             <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold text-[#6b7a8d]"><Layers className="h-3.5 w-3.5" /> Analyzed TAs</span>
                <span className="text-xs font-bold text-[#0F2A3D]">{topTaCounts.length || "..."}</span>
             </div>
             <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold text-[#6b7a8d]"><MapPin className="h-3.5 w-3.5" /> Analyzed Districts</span>
                <span className="text-xs font-bold text-[#0F2A3D]">{Object.keys(liveDistricts).length || "..."}</span>
             </div>
          </div>
          
          {topTaCounts.length > 0 && (
             <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
               <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#6b7a8d]">Largest TA Grids</h4>
               <div className="space-y-2">
                 {topTaCounts.slice(0, 4).map((ta, idx) => (
                    <div key={ta.traditional_authority} className="flex justify-between items-center text-xs">
                        <span className="truncate pr-2 font-medium text-[#0F2A3D]">{idx+1}. {ta.traditional_authority}</span>
                        <span className="font-bold text-[#6b7a8d]">{ta.grid_cell_count} cells</span>
                    </div>
                 ))}
               </div>
             </div>
          )}
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
                href={`/map/historical?district=${encodeURIComponent(selectedDistrict.name)}`}
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
