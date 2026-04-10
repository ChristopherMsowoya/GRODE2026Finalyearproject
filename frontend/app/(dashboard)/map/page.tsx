"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Layers, Loader2, MapPinned, Navigation2, X, ZoomIn, ZoomOut } from "lucide-react"
import * as L from "leaflet"
import type { Map as LeafletMap, PathOptions } from "leaflet"

import {
  fetchBoundaries,
  fetchDistrictSummary,
  type DistrictSummary,
  type GeoJsonFeatureCollection,
} from "@/lib/algorithm-api"

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false })
const GeoJSON = dynamic(() => import("react-leaflet").then((m) => m.GeoJSON), { ssr: false })

const TILES = {
  terrain: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attr: "OpenTopoMap" },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: "Esri",
  },
  street: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "OpenStreetMap" },
} as const

function colorForRisk(level: DistrictSummary["overall_risk_level"] | undefined) {
  if (level === "High") return "#D64545"
  if (level === "Medium") return "#D97706"
  return "#1F7A63"
}

function percent(value: number | undefined) {
  return `${Math.round((value ?? 0) * 100)}%`
}

function plantingAdvice(summary: DistrictSummary | undefined) {
  if (!summary) {
    return "Select a district to see planting guidance."
  }

  if (summary.average_false_onset_probability > 0.3 || summary.average_crop_stress_probability > 0.3) {
    return "Wait for follow-up rain before planting across a large area."
  }

  if (summary.onset_detection_rate >= 0.6) {
    return "The rainfall signal looks steadier here than in many other areas."
  }

  return "Use the first rains carefully and confirm that more rain follows."
}

function makeDistrictStyle(summary: DistrictSummary | undefined): PathOptions {
  return {
    fillColor: colorForRisk(summary?.overall_risk_level),
    color: "#eab308",
    weight: 1.5,
    opacity: 1,
    fillOpacity: 0.42,
  }
}

function hoverDistrictStyle(summary: DistrictSummary | undefined): PathOptions {
  return {
    fillColor: colorForRisk(summary?.overall_risk_level),
    color: "#0F2A3D",
    weight: 2.5,
    opacity: 1,
    fillOpacity: 0.62,
  }
}

export default function MapPage() {
  const mapRef = useRef<LeafletMap | null>(null)
  const [layerStyle, setLayerStyle] = useState<keyof typeof TILES>("terrain")
  const [districts, setDistricts] = useState<GeoJsonFeatureCollection | null>(null)
  const [districtSummaries, setDistrictSummaries] = useState<DistrictSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDistrictName, setSelectedDistrictName] = useState<string | null>(null)
  const [cardVisible, setCardVisible] = useState(true)

  useEffect(() => {
    const loadMapData = async () => {
      try {
        const [boundaryData, summaryData] = await Promise.all([
          fetchBoundaries("districts", true),
          fetchDistrictSummary(),
        ])

        setDistricts(boundaryData)
        setDistrictSummaries(summaryData.districts)

        const firstName = boundaryData.features[0]?.properties?.shapeName
        if (typeof firstName === "string") {
          setSelectedDistrictName(firstName)
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load district map data.")
      } finally {
        setLoading(false)
      }
    }

    void loadMapData()
  }, [])

  const summaryByDistrict = useMemo(
    () => new Map(districtSummaries.map((summary) => [summary.district, summary])),
    [districtSummaries]
  )

  const selectedDistrictSummary = selectedDistrictName ? summaryByDistrict.get(selectedDistrictName) : undefined

  const onEachFeature = (feature: GeoJSON.Feature, layer: L.Layer) => {
    const districtName = feature.properties?.shapeName || "Unknown district"
    const summary = typeof districtName === "string" ? summaryByDistrict.get(districtName) : undefined

    layer.on({
      mouseover(e: { target: L.Path }) {
        e.target.setStyle(hoverDistrictStyle(summary))
        e.target.bringToFront()
      },
      mouseout(e: { target: L.Path }) {
        e.target.setStyle(makeDistrictStyle(summary))
      },
      click() {
        setSelectedDistrictName(typeof districtName === "string" ? districtName : "Unknown district")
        setCardVisible(true)
      },
    })
  }

  const zoomIn = () => mapRef.current?.zoomIn()
  const zoomOut = () => mapRef.current?.zoomOut()
  const recenter = () => mapRef.current?.setView([-13.5, 34.2], 7)
  const cycleLayer = () => setLayerStyle((current) => (current === "terrain" ? "satellite" : current === "satellite" ? "street" : "terrain"))

  return (
    <>
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .leaflet-container { background: #e9f1e7 !important; }
        .leaflet-control-zoom { display: none !important; }
        .leaflet-control-attribution { display: none !important; }
      `}</style>

      <div className="relative overflow-hidden rounded-2xl" style={{ height: "calc(100vh - 7.5rem)" }}>
        <MapContainer center={[-13.5, 34.2]} zoom={7} style={{ height: "100%", width: "100%" }} zoomControl={false} ref={mapRef}>
          <TileLayer key={layerStyle} url={TILES[layerStyle].url} attribution={TILES[layerStyle].attr} />
          {districts && (
            <GeoJSON
              key="districts"
              data={districts as any}
              style={(feature: any) => makeDistrictStyle(summaryByDistrict.get(feature?.properties?.shapeName))}
              onEachFeature={onEachFeature}
            />
          )}
        </MapContainer>

        <div className="absolute left-6 top-6 z-[800] max-w-md rounded-2xl bg-white/90 p-5 backdrop-blur-md" style={{ boxShadow: "0 12px 30px rgba(15,42,61,0.12)" }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a8d]">Live District Map</p>
          <h1 className="mt-2 text-[28px] font-extrabold leading-tight text-[#0F2A3D]">Malawi District Risk Map</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#6b7a8d]">
            District colors come from the same rainfall analysis used across the dashboard, onset, false-onset, and crop-stress pages.
          </p>
        </div>

        {loading && (
          <div className="absolute inset-0 z-[850] flex items-center justify-center bg-white/45 backdrop-blur-sm">
            <div className="rounded-2xl bg-white px-5 py-4 text-[#0F2A3D] shadow-lg">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-semibold">Loading district risk map...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute left-6 top-32 z-[850] rounded-2xl bg-[#fff5f5] px-5 py-4 text-sm text-[#8a3030] shadow-lg">
            {error}
          </div>
        )}

        {cardVisible && selectedDistrictName && (
          <div className="absolute bottom-6 left-1/2 z-[800] w-[480px] -translate-x-1/2 rounded-[20px] bg-white/95 p-5 backdrop-blur-md" style={{ boxShadow: "0 16px 48px rgba(15,42,61,0.2)" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-block rounded-full bg-[#1F7A63] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                  Selected District
                </span>
                <h2 className="mt-3 text-[24px] font-extrabold text-[#0F2A3D]">{selectedDistrictName}</h2>
              </div>
              <button onClick={() => setCardVisible(false)} className="rounded-full p-1.5 hover:bg-[#f4f7fa]">
                <X className="h-4 w-4 text-[#6b7a8d]" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#f8fafb] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a8d]">Planting risk</p>
                <p className="mt-2 text-[20px] font-extrabold" style={{ color: colorForRisk(selectedDistrictSummary?.overall_risk_level) }}>
                  {selectedDistrictSummary?.overall_risk_level || "Low"}
                </p>
              </div>
              <div className="rounded-2xl bg-[#f8fafb] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a8d]">Onset seen</p>
                <p className="mt-2 text-[20px] font-extrabold text-[#0F2A3D]">
                  {percent(selectedDistrictSummary?.onset_detection_rate)}
                </p>
              </div>
              <div className="rounded-2xl bg-[#f8fafb] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a8d]">False onset</p>
                <p className="mt-2 text-[20px] font-extrabold text-[#0F2A3D]">
                  {percent(selectedDistrictSummary?.average_false_onset_probability)}
                </p>
              </div>
              <div className="rounded-2xl bg-[#f8fafb] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a8d]">Crop stress</p>
                <p className="mt-2 text-[20px] font-extrabold text-[#0F2A3D]">
                  {percent(selectedDistrictSummary?.average_crop_stress_probability)}
                </p>
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-[#6b7a8d]">
              {plantingAdvice(selectedDistrictSummary)}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/onset" className="rounded-xl bg-[#0F2A3D] px-4 py-3 text-[13px] font-bold text-white">
                Onset Info
              </Link>
              <Link href="/false-onset" className="rounded-xl bg-[#0F2A3D] px-4 py-3 text-[13px] font-bold text-white">
                False Onset View
              </Link>
              <Link href="/crop-stress" className="rounded-xl border border-[#d7dde5] px-4 py-3 text-[13px] font-semibold text-[#0F2A3D]">
                Crop Stress View
              </Link>
            </div>
          </div>
        )}

        {!cardVisible && selectedDistrictName && (
          <button
            onClick={() => setCardVisible(true)}
            className="absolute bottom-6 left-1/2 z-[800] -translate-x-1/2 rounded-xl bg-white/92 px-5 py-3 text-[13px] font-bold text-[#0F2A3D] shadow-lg backdrop-blur-md"
          >
            Show District Info
          </button>
        )}

        <div className="absolute bottom-6 left-6 z-[800] rounded-2xl bg-white/92 p-4 backdrop-blur-md shadow-lg">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a8d]">Risk Legend</h3>
          <div className="space-y-2 text-[13px] text-[#0F2A3D]">
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#1F7A63]" />Low</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#D97706]" />Medium</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#D64545]" />High</div>
          </div>
        </div>

        <div className="absolute right-5 bottom-6 z-[800] flex flex-col gap-2">
          {[
            { icon: <ZoomIn className="h-5 w-5" />, action: zoomIn, label: "Zoom in" },
            { icon: <ZoomOut className="h-5 w-5" />, action: zoomOut, label: "Zoom out" },
            { icon: <Layers className="h-5 w-5" />, action: cycleLayer, label: "Change layer" },
            { icon: <Navigation2 className="h-5 w-5" />, action: recenter, label: "Recenter" },
          ].map((control) => (
            <button
              key={control.label}
              onClick={control.action}
              title={control.label}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 text-[#0F2A3D] shadow-lg backdrop-blur-md transition hover:scale-105"
            >
              {control.icon}
            </button>
          ))}
        </div>

        <div className="absolute right-5 top-6 z-[800] rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0F2A3D] shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2">
            <MapPinned className="h-4 w-4" />
            {layerStyle}
          </div>
        </div>
      </div>
    </>
  )
}
