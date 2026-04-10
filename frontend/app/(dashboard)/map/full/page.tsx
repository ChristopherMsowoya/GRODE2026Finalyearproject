"use client"

import { useState, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import {
  Plus, Minus, Layers, Share2, MapPin, BarChart2,
  NavigationIcon, Search, X, ChevronRight,
} from "lucide-react"
import type { Map as LeafletMap, Layer, PathOptions } from "leaflet"

const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false })
const TileLayer    = dynamic(() => import("react-leaflet").then(m => m.TileLayer),    { ssr: false })
const GeoJSON      = dynamic(() => import("react-leaflet").then(m => m.GeoJSON),      { ssr: false })

interface DistrictProps {
  name:           string
  riskLevel:      "optimal" | "caution" | "alert"
  moisture:       number
  temperature:    number
  plantingWindow: string
  forecastOnset:  string
}

const malawiDistricts: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    { type:"Feature", properties:{ name:"Lilongwe Central", riskLevel:"optimal",  moisture:82, temperature:28, plantingWindow:"Closing",  forecastOnset:"Nov 14" }, geometry:{ type:"Polygon", coordinates:[[[33.70,-14.10],[34.00,-13.95],[34.25,-13.70],[34.40,-13.45],[34.30,-13.15],[34.00,-13.05],[33.75,-13.10],[33.50,-13.35],[33.45,-13.65],[33.55,-13.90],[33.70,-14.10]]] } },
    { type:"Feature", properties:{ name:"Lilongwe North",   riskLevel:"caution",  moisture:61, temperature:26, plantingWindow:"Open",     forecastOnset:"Nov 18" }, geometry:{ type:"Polygon", coordinates:[[[33.75,-13.10],[34.00,-13.05],[34.30,-13.15],[34.50,-12.90],[34.40,-12.60],[34.10,-12.45],[33.80,-12.50],[33.60,-12.75],[33.55,-13.00],[33.75,-13.10]]] } },
    { type:"Feature", properties:{ name:"Lilongwe South",   riskLevel:"alert",    moisture:35, temperature:31, plantingWindow:"Closed",   forecastOnset:"Nov 24" }, geometry:{ type:"Polygon", coordinates:[[[33.70,-14.10],[33.55,-13.90],[33.45,-13.65],[33.20,-13.80],[33.05,-14.10],[33.10,-14.45],[33.30,-14.65],[33.55,-14.60],[33.70,-14.35],[33.70,-14.10]]] } },
    { type:"Feature", properties:{ name:"Kasungu",          riskLevel:"optimal",  moisture:72, temperature:25, plantingWindow:"Open",     forecastOnset:"Nov 12" }, geometry:{ type:"Polygon", coordinates:[[[33.80,-12.50],[34.10,-12.45],[34.40,-12.60],[34.60,-12.35],[34.50,-12.00],[34.20,-11.80],[33.90,-11.85],[33.65,-12.00],[33.55,-12.25],[33.80,-12.50]]] } },
    { type:"Feature", properties:{ name:"Dowa",             riskLevel:"optimal",  moisture:65, temperature:26, plantingWindow:"Open",     forecastOnset:"Nov 15" }, geometry:{ type:"Polygon", coordinates:[[[34.00,-13.05],[34.25,-13.70],[34.50,-13.60],[34.70,-13.35],[34.80,-13.05],[34.60,-12.90],[34.30,-13.15],[34.00,-13.05]]] } },
    { type:"Feature", properties:{ name:"Salima",           riskLevel:"caution",  moisture:55, temperature:29, plantingWindow:"Closing",  forecastOnset:"Nov 19" }, geometry:{ type:"Polygon", coordinates:[[[34.40,-13.45],[34.25,-13.70],[34.50,-13.60],[34.70,-13.35],[34.80,-13.05],[35.00,-13.20],[35.10,-13.50],[34.90,-13.70],[34.60,-13.75],[34.40,-13.45]]] } },
    { type:"Feature", properties:{ name:"Dedza",            riskLevel:"alert",    moisture:30, temperature:32, plantingWindow:"Closed",   forecastOnset:"Nov 26" }, geometry:{ type:"Polygon", coordinates:[[[34.25,-13.70],[34.40,-13.45],[34.60,-13.75],[34.80,-13.90],[34.70,-14.20],[34.40,-14.30],[34.10,-14.15],[34.00,-13.95],[34.25,-13.70]]] } },
    { type:"Feature", properties:{ name:"Ntcheu",           riskLevel:"caution",  moisture:44, temperature:28, plantingWindow:"Open",     forecastOnset:"Nov 21" }, geometry:{ type:"Polygon", coordinates:[[[34.40,-14.30],[34.70,-14.20],[34.80,-13.90],[35.10,-14.00],[35.20,-14.30],[35.00,-14.60],[34.70,-14.65],[34.50,-14.50],[34.40,-14.30]]] } },
    { type:"Feature", properties:{ name:"Mzimba",           riskLevel:"optimal",  moisture:71, temperature:24, plantingWindow:"Open",     forecastOnset:"Nov 13" }, geometry:{ type:"Polygon", coordinates:[[[33.00,-11.00],[33.50,-10.80],[34.00,-10.90],[34.30,-11.20],[34.20,-11.60],[33.90,-11.85],[33.65,-12.00],[33.30,-11.80],[33.00,-11.50],[33.00,-11.00]]] } },
    { type:"Feature", properties:{ name:"Rumphi",           riskLevel:"optimal",  moisture:75, temperature:23, plantingWindow:"Open",     forecastOnset:"Nov 11" }, geometry:{ type:"Polygon", coordinates:[[[33.50,-10.80],[34.00,-10.90],[34.30,-10.60],[34.10,-10.20],[33.70,-10.10],[33.30,-10.30],[33.20,-10.60],[33.50,-10.80]]] } },
    { type:"Feature", properties:{ name:"Karonga",          riskLevel:"optimal",  moisture:78, temperature:23, plantingWindow:"Open",     forecastOnset:"Nov 10" }, geometry:{ type:"Polygon", coordinates:[[[33.70,-10.10],[34.10,-10.20],[34.30,-10.60],[34.50,-10.50],[34.40,-9.90],[34.00,-9.70],[33.60,-9.80],[33.50,-10.10],[33.70,-10.10]]] } },
    { type:"Feature", properties:{ name:"Blantyre",         riskLevel:"alert",    moisture:28, temperature:33, plantingWindow:"Closed",   forecastOnset:"Nov 28" }, geometry:{ type:"Polygon", coordinates:[[[35.00,-15.60],[35.20,-15.30],[35.40,-15.10],[35.60,-15.20],[35.65,-15.55],[35.45,-15.80],[35.10,-15.85],[35.00,-15.60]]] } },
    { type:"Feature", properties:{ name:"Zomba",            riskLevel:"caution",  moisture:50, temperature:30, plantingWindow:"Closing",  forecastOnset:"Nov 22" }, geometry:{ type:"Polygon", coordinates:[[[35.10,-15.35],[35.30,-15.05],[35.50,-14.90],[35.70,-15.10],[35.65,-15.45],[35.40,-15.55],[35.20,-15.45],[35.10,-15.35]]] } },
    { type:"Feature", properties:{ name:"Mangochi",         riskLevel:"caution",  moisture:58, temperature:29, plantingWindow:"Open",     forecastOnset:"Nov 17" }, geometry:{ type:"Polygon", coordinates:[[[35.10,-13.50],[35.20,-13.30],[35.40,-13.10],[35.60,-13.30],[35.70,-13.60],[35.60,-14.00],[35.35,-14.20],[35.10,-14.10],[35.00,-13.80],[35.10,-13.50]]] } },
    { type:"Feature", properties:{ name:"Mulanje",          riskLevel:"alert",    moisture:25, temperature:34, plantingWindow:"Closed",   forecastOnset:"Nov 30" }, geometry:{ type:"Polygon", coordinates:[[[35.45,-15.80],[35.65,-15.55],[35.85,-15.60],[35.90,-15.90],[35.70,-16.10],[35.40,-16.05],[35.30,-15.90],[35.45,-15.80]]] } },
    { type:"Feature", properties:{ name:"Chikwawa",         riskLevel:"alert",    moisture:32, temperature:34, plantingWindow:"Closed",   forecastOnset:"Nov 27" }, geometry:{ type:"Polygon", coordinates:[[[34.75,-15.65],[34.85,-15.90],[35.00,-16.20],[34.90,-16.20],[34.80,-16.50],[34.50,-16.40],[34.30,-16.10],[34.40,-15.80],[34.60,-15.60],[34.75,-15.65]]] } },
  ],
}

const RISK = {
  optimal: { fill: "#1F7A63", hover: "#17634f" },
  caution: { fill: "#F4A261", hover: "#d97706" },
  alert:   { fill: "#D64545", hover: "#b53030" },
}

function getStyle(riskLevel: string, hovered = false): PathOptions {
  const c = RISK[riskLevel as keyof typeof RISK] || RISK.optimal
  return { fillColor: hovered ? c.hover : c.fill, color: hovered ? "#fff" : "rgba(255,255,255,0.6)", weight: hovered ? 2 : 1, opacity: 1, fillOpacity: hovered ? 0.82 : 0.58 }
}

const LAYERS_INIT = [
  { id:"rainfall",   name:"Rainfall Intensity",  desc:"Live Doppler Feed",       icon:"🌧", iconBg:"#1e3a52", enabled:true  },
  { id:"crop",       name:"Crop Stress Zones",    desc:"NDVI Satellite Data",     icon:"🌿", iconBg:"#1a3d2a", enabled:true  },
  { id:"boundaries", name:"District Boundaries",  desc:"Administrative Lines",    icon:"▦",  iconBg:"#2a3a1a", enabled:false },
]

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-all duration-150"
      style={{ background: checked ? "#1F7A63" : "rgba(255,255,255,0.15)", border: checked ? "none" : "1.5px solid rgba(255,255,255,0.3)" }}>
      {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </button>
  )
}

export default function FullMapPage() {
  const mapRef = useRef<LeafletMap | null>(null)
  const [selected, setSelected] = useState<DistrictProps>({ name:"Lilongwe Central", riskLevel:"optimal", moisture:82, temperature:28, plantingWindow:"Closing", forecastOnset:"Nov 14" })
  const [hovered,   setHovered]   = useState<string | null>(null)
  const [layers,    setLayers]    = useState(LAYERS_INIT)
  const [tileStyle, setTileStyle] = useState<"satellite"|"terrain">("satellite")
  const [search,    setSearch]    = useState("")

  const TILES = {
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    terrain:   "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  }

  const toggleLayer = (id: string) => setLayers(ls => ls.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l))

  const onEachFeature = useCallback((feature: GeoJSON.Feature, layer: Layer) => {
    const props = feature.properties as DistrictProps
    layer.on({
      mouseover(e: { target: L.Path }) { setHovered(props.name); e.target.setStyle(getStyle(props.riskLevel, true)); e.target.bringToFront() },
      mouseout(e: { target: L.Path })  { setHovered(null);       e.target.setStyle(getStyle(props.riskLevel, false)) },
      click() { setSelected(props) },
    })
  }, [])

  const featureStyle = useCallback((feature?: GeoJSON.Feature): PathOptions => getStyle(feature?.properties?.riskLevel || "optimal"), [])
  const zoomIn   = () => mapRef.current?.zoomIn()
  const zoomOut  = () => mapRef.current?.zoomOut()
  const recenter = () => mapRef.current?.setView([-13.5, 34.2], 7)
  const cycleTile = () => setTileStyle(t => t === "satellite" ? "terrain" : "satellite")
  const plantingColor = selected.plantingWindow === "Open" ? "#1F7A63" : selected.plantingWindow === "Closing" ? "#F4A261" : "#D64545"

  return (
    <>
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .leaflet-container { background: #1a2332 !important; }
        .leaflet-control-zoom { display: none !important; }
        .leaflet-control-attribution { display: none !important; }
      `}</style>

      <div className="relative -m-7 overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>
        <MapContainer center={[-13.5, 34.2]} zoom={7} style={{ height:"100%", width:"100%" }} zoomControl={false} ref={mapRef}>
          <TileLayer key={tileStyle} url={TILES[tileStyle]} attribution="" />
          <GeoJSON key="districts" data={malawiDistricts} style={featureStyle} onEachFeature={onEachFeature} />
        </MapContainer>

        {/* Search + Zoom */}
        <div className="absolute left-5 top-5 z-[800] w-[260px] space-y-2">
          <div className="flex items-center gap-2 rounded-2xl px-4 py-3" style={{ background:"rgba(240,244,248,0.96)", backdropFilter:"blur(12px)", boxShadow:"0 4px 20px rgba(15,42,61,0.14)" }}>
            <Search className="h-4 w-4 flex-shrink-0 text-[#6b7a8d]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Locate District or Farm..." className="flex-1 bg-transparent text-[13px] font-medium text-[#1a2332] outline-none placeholder:text-[#6b7a8d]" />
            {search && <button onClick={() => setSearch("")}><X className="h-3.5 w-3.5 text-[#6b7a8d]" /></button>}
          </div>
          <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background:"rgba(240,244,248,0.96)", backdropFilter:"blur(12px)", boxShadow:"0 4px 20px rgba(15,42,61,0.14)" }}>
            <button onClick={zoomIn}  className="flex h-8 w-8 items-center justify-center rounded-xl text-[#0F2A3D] transition hover:bg-[#e2e8f0]"><Plus  className="h-4 w-4" /></button>
            <button onClick={zoomOut} className="flex h-8 w-8 items-center justify-center rounded-xl text-[#0F2A3D] transition hover:bg-[#e2e8f0]"><Minus className="h-4 w-4" /></button>
            <div className="flex-1" />
            <button onClick={recenter} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[#0F2A3D] transition hover:bg-[#e2e8f0]">
              <NavigationIcon className="h-3 w-3" />Center View
            </button>
          </div>
        </div>

        {/* Intelligence Layers */}
        <div className="absolute left-5 top-[136px] z-[800] w-[260px] rounded-2xl p-4" style={{ background:"rgba(240,244,248,0.96)", backdropFilter:"blur(12px)", boxShadow:"0 4px 20px rgba(15,42,61,0.14)" }}>
          <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.15em]" style={{ color:"#6b7a8d" }}>Intelligence Layers</h3>
          <div className="space-y-2.5">
            {layers.map(layer => (
              <div key={layer.id} className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[14px]" style={{ background:layer.iconBg }}>{layer.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold leading-tight" style={{ color:"#1a2332" }}>{layer.name}</p>
                  <p className="text-[11px]" style={{ color:"#6b7a8d" }}>{layer.desc}</p>
                </div>
                <Checkbox checked={layer.enabled} onChange={() => toggleLayer(layer.id)} />
              </div>
            ))}
          </div>
        </div>

        {/* Risk Legend */}
        <div className="absolute left-5 top-[322px] z-[800] w-[260px] rounded-2xl p-4" style={{ background:"rgba(240,244,248,0.96)", backdropFilter:"blur(12px)", boxShadow:"0 4px 20px rgba(15,42,61,0.14)" }}>
          <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.15em]" style={{ color:"#6b7a8d" }}>Risk Legend</h3>
          <div className="h-2.5 w-full rounded-full mb-2.5" style={{ background:"linear-gradient(to right, #1F7A63 0%, #F4A261 50%, #D64545 100%)" }} />
          <div className="flex justify-between">
            {["Optimal","Moderate","High Risk"].map((label, i) => (
              <span key={label} className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: i===0?"#1F7A63":i===1?"#F4A261":"#D64545" }}>{label}</span>
            ))}
          </div>
        </div>

        {/* Right controls */}
        <div className="absolute right-5 top-5 z-[800] flex flex-col gap-2">
          {[
            { icon:<Layers className="h-4 w-4"/>,   tip:"Layer",  action:cycleTile },
            { icon:<BarChart2 className="h-4 w-4"/>, tip:"Data",   action:()=>{} },
            { icon:<Share2 className="h-4 w-4"/>,   tip:"Share",  action:()=>{} },
            { icon:<MapPin className="h-4 w-4"/>,   tip:"Pin",    action:()=>{} },
          ].map(({icon,tip,action}) => (
            <button key={tip} onClick={action} title={tip} className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ background:"rgba(255,255,255,0.92)", backdropFilter:"blur(10px)", boxShadow:"0 4px 14px rgba(15,42,61,0.14)", color:"#0F2A3D" }}>
              {icon}
            </button>
          ))}
        </div>

        {/* Hover tooltip */}
        {hovered && (
          <div className="absolute right-20 top-5 z-[800] rounded-xl px-4 py-2 text-[13px] font-semibold text-white" style={{ background:"rgba(15,42,61,0.88)", backdropFilter:"blur(8px)" }}>
            📍 {hovered}
          </div>
        )}

        {/* Bottom district card */}
        <div className="absolute bottom-0 z-[800] px-6 pb-5" style={{ left:"50%", transform:"translateX(-50%)", width:"min(900px, 100%)" }}>
          <div className="flex items-center gap-6 rounded-2xl px-6 py-4"
            style={{ background:"rgba(240,244,248,0.97)", backdropFilter:"blur(20px)", boxShadow:"0 -4px 0 rgba(31,122,99,0.15), 0 8px 40px rgba(15,42,61,0.22)", border:"1px solid rgba(255,255,255,0.8)" }}>
            <div className="flex-shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color:"#6b7a8d" }}>Focused District</span>
              <h2 className="text-[20px] font-extrabold leading-tight mt-0.5" style={{ color:"#0F2A3D" }}>{selected.name}</h2>
            </div>
            <div className="h-10 w-px flex-shrink-0" style={{ background:"#e2e8f0" }} />
            <div className="flex-shrink-0 text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] block" style={{ color:"#6b7a8d" }}>Moisture</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-[22px] font-black leading-none" style={{ color:"#1F7A63" }}>{selected.moisture}%</span>
                <span className="text-[11px] font-bold" style={{ color:"#1F7A63" }}>Lush</span>
              </div>
            </div>
            <div className="h-10 w-px flex-shrink-0" style={{ background:"#e2e8f0" }} />
            <div className="flex-shrink-0 text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] block" style={{ color:"#6b7a8d" }}>Temp</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-[22px] font-black leading-none" style={{ color:"#0F2A3D" }}>{selected.temperature}°C</span>
                <span className="text-[11px] font-bold text-[#6b7a8d]">Avg</span>
              </div>
            </div>
            <div className="h-10 w-px flex-shrink-0" style={{ background:"#e2e8f0" }} />
            <div className="flex-shrink-0 text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] block" style={{ color:"#6b7a8d" }}>Planting Window</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[18px] font-extrabold leading-none" style={{ color:plantingColor }}>{selected.plantingWindow}</span>
                {selected.plantingWindow === "Closing" && <span className="text-[13px]" style={{ color:plantingColor }}>→</span>}
              </div>
            </div>
            <div className="flex-1" />
            <div className="flex-shrink-0 text-right">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] block" style={{ color:"#6b7a8d" }}>Forecast Onset</span>
              <span className="text-[18px] font-extrabold" style={{ color:"#0F2A3D" }}>{selected.forecastOnset}</span>
            </div>
            <Link href="/details" className="flex flex-shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-bold text-white transition-all hover:opacity-90 hover:shadow-lg active:scale-95"
              style={{ background:"linear-gradient(135deg, #0F2A3D 0%, #1a3d54 100%)" }}>
              Detailed Forecast<ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Tile badge */}
        <div className="absolute right-[68px] top-5 z-[800] rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide"
          style={{ background:"rgba(255,255,255,0.90)", backdropFilter:"blur(8px)", color:"#0F2A3D", boxShadow:"0 2px 8px rgba(15,42,61,0.12)" }}>
          {tileStyle === "satellite" ? "🛰 Satellite" : "🗻 Terrain"}
        </div>
      </div>
    </>
  )
}
