"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import {
  fetchBoundaries,
  fetchGridDiagnostics,
  type DistrictSummary,
  type GridDiagnosticProperties,
} from "../../../lib/algorithm-api"
import type { SelectedLocation } from "@/components/location-selector"

interface DrySpellMapProps {
  selectedLocation: SelectedLocation | null
  onLocationChange: (location: SelectedLocation) => void
  userDistrict: string
  onDistrictDataLoad?: (data: DistrictSummary[]) => void
}

const LEGEND = [
  { min: 0, max: 20, label: "Very Low", color: "#dbeafe" },
  { min: 21, max: 40, label: "Low", color: "#93c5fd" },
  { min: 41, max: 60, label: "Moderate", color: "#facc15" },
  { min: 61, max: 80, label: "High", color: "#fb923c" },
  { min: 81, max: 100, label: "Very High", color: "#dc2626" },
]

function colorFor(probability = 0) {
  const pct = Math.max(0, Math.min(100, probability * 100))
  return LEGEND.find((bin) => pct >= bin.min && pct <= bin.max)?.color ?? LEGEND[0].color
}

function percent(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "-"
}

function toSelectedLocation(props: GridDiagnosticProperties): SelectedLocation {
  const seasons = props.seasons_analyzed ?? 0
  const onsetProbability = props.onset_probability ?? (
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
      onset_probability: onsetProbability,
      seasons_analyzed: seasons,
      seasons_with_detected_onset: props.seasons_with_detected_onset ?? 0,
      first_detected_onset_date: props.first_detected_onset_date ?? null,
      latest_detected_onset_date: props.latest_detected_onset_date ?? null,
      false_onset_interpretation: props.false_onset_interpretation ?? "",
      dry_spell_interpretation: props.dry_spell_interpretation ?? "",
    },
  }
}

export default function DrySpellMap({ selectedLocation, onLocationChange, onDistrictDataLoad }: DrySpellMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const gridLayer = useRef<L.GeoJSON | null>(null)
  const overlayLayers = useRef<L.Layer[]>([])
  const [isClient, setIsClient] = useState(false)

  useEffect(() => setIsClient(true), [])

  useEffect(() => {
    if (!isClient || !mapContainer.current || map.current) return

    map.current = L.map(mapContainer.current, {
      center: [-13.2543, 34.3015],
      zoom: 7,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    })
    L.control.zoom({ position: "topright" }).addTo(map.current)

    const legend = (L.control as any)({ position: "bottomright" })
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "map-legend")
      div.style.cssText = "background:white;padding:12px 16px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.12);font-family:Inter,sans-serif;font-size:12px;min-width:190px;"
      div.innerHTML = `
        <p style="margin:0 0 8px 0;font-weight:800;color:#0d2f3f;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Dry Spell Probability</p>
        ${LEGEND.map((bin) => `
          <div style="margin-bottom:6px;display:flex;align-items:center;gap:7px;">
            <span style="display:inline-block;width:18px;height:12px;border-radius:3px;background:${bin.color};border:1px solid rgba(0,0,0,.12);"></span>
            <span style="color:#0d2f3f;font-weight:600;">${bin.min}% - ${bin.max}%</span>
            <span style="color:#64748b;">${bin.label}</span>
          </div>
        `).join("")}
      `
      return div
    }
    legend.addTo(map.current)
  }, [isClient])

  useEffect(() => {
    if (!isClient || !map.current) return

    gridLayer.current?.remove()
    overlayLayers.current.forEach((layer) => layer.remove())
    overlayLayers.current = []

    async function draw() {
      const [country, districts, grid] = await Promise.all([
        fetchBoundaries("country", true),
        fetchBoundaries("districts", true),
        fetchGridDiagnostics({ limit: 12000, source_grid: "esri_5km_v1" }),
      ])
      if (!map.current) return

      const countryLayer = L.geoJSON(country as any, { style: { color: "#0b3a4a", weight: 2.4, fillOpacity: 0 } }).addTo(map.current)
      const districtLayer = L.geoJSON(districts as any, {
        style: { color: "#111827", weight: 1.1, fillOpacity: 0, opacity: 0.8, dashArray: "3,4" },
      }).addTo(map.current)
      overlayLayers.current = [countryLayer, districtLayer]

      try { map.current.fitBounds(countryLayer.getBounds(), { padding: [20, 20] }) } catch {}

      gridLayer.current = L.geoJSON(grid as any, {
        style: (feature: any) => {
          const props = feature?.properties || {}
          const selected = selectedLocation?.grid === props.grid_id
          return {
            fillColor: colorFor(Number(props.dry_spell_probability ?? 0)),
            color: selected ? "#ffffff" : "#334155",
            weight: selected ? 1.8 : 0.35,
            opacity: selected ? 1 : 0.55,
            fillOpacity: selected ? 0.92 : 0.72,
          }
        },
        onEachFeature: (feature: any, layer: any) => {
          const props = feature.properties || {}
          const gid = props.grid_id || "-"
          layer.bindTooltip(`Grid ${gid}: ${percent(props.dry_spell_probability)}`, { sticky: true })
          layer.bindPopup(`
            <div style="font-family:Inter,sans-serif;color:#0d2f3f;min-width:220px;">
              <strong>Grid ${gid}</strong><br/>
              <span style="color:#64748b;">District:</span> ${props.district_name || "Unknown"}<br/>
              <span style="color:#64748b;">Onset Probability:</span> ${percent(props.onset_probability)}<br/>
              <span style="color:#64748b;">False-Onset Probability:</span> ${percent(props.false_onset_probability)}<br/>
              <span style="color:#64748b;">Dry Spell Probability:</span> <strong>${percent(props.dry_spell_probability)}</strong><br/>
              <span style="color:#64748b;">Season Summary:</span> ${props.seasons_analyzed ?? 0} seasons
            </div>
          `)
          layer.on("click", () => onLocationChange(toSelectedLocation(props)))
          layer.on("mouseover", function (this: any) { this.setStyle({ weight: 1.6, fillOpacity: 0.95 }) })
          layer.on("mouseout", function (this: any) { gridLayer.current?.resetStyle(this) })
        },
      }).addTo(map.current)

      onDistrictDataLoad?.([])
    }

    void draw()
  }, [isClient, selectedLocation?.grid, onLocationChange, onDistrictDataLoad])

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "600px" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%", minHeight: "600px" }} />
    </div>
  )
}
