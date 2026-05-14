"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { fetchDistrictSummary, fetchGridDiagnostics, fetchBoundaries, type DistrictSummary } from "../../../lib/algorithm-api"
import type { SelectedLocation } from "@/components/location-selector"

interface FalseOnsetMapProps {
  selectedLocation: SelectedLocation | null
  onLocationChange: (location: SelectedLocation) => void
  userDistrict?: string | null
  onDistrictDataLoad?: (data: DistrictSummary[]) => void
}

// Color map for false-onset risk level
function getFalseOnsetColor(falseOnsetProb: number): string {
  if (falseOnsetProb > 0.60) return "#e36a6a"   // High – Red
  if (falseOnsetProb > 0.30) return "#f2b24a"   // Medium – Orange
  return "#9fd3a8"                                // Low – Green
}

function getRiskLabel(prob: number): string {
  if (prob > 0.60) return "High"
  if (prob > 0.30) return "Medium"
  return "Low"
}

export default function FalseOnsetMap({
  selectedLocation,
  onLocationChange,
  userDistrict,
  onDistrictDataLoad,
}: FalseOnsetMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [districtRiskMap, setDistrictRiskMap] = useState<Record<string, DistrictSummary>>({})
  const [apiStatus, setApiStatus] = useState<"loading" | "live" | "pending" | "error">("loading")
  const districtLayers = useRef<Map<string, L.GeoJSON<any>>>(new Map())
  const legendRef = useRef<L.Control<any> | null>(null)
  const statusControlRef = useRef<L.Control<any> | null>(null)
  const boundsGeojsonRef = useRef<L.GeoJSON | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Fetch live district data from API
  useEffect(() => {
    let cancelled = false

    async function loadDistrictData() {
      try {
        const response = await fetchDistrictSummary()
        if (cancelled) return

        // Check if pipeline has been run yet
        if ((response as any).pipeline_status === "not_run") {
          setApiStatus("pending")
          onDistrictDataLoad?.([])
          return
        }

        const riskMap: Record<string, DistrictSummary> = {}
        for (const d of response.districts) {
          riskMap[d.district] = d
        }
        setDistrictRiskMap(riskMap)
        setApiStatus("live")
        onDistrictDataLoad?.(response.districts)
      } catch {
        if (!cancelled) setApiStatus("error")
      }
    }

    loadDistrictData()
    return () => { cancelled = true }
  }, [onDistrictDataLoad])

  // Initialize map
  useEffect(() => {
    if (!isClient || !mapContainer.current || map.current) return

    map.current = L.map(mapContainer.current, {
      center: [-13.2543, 34.3015],
      zoom: 7,
      zoomControl: false,
      attributionControl: false,
    })

    // No street tiles. We'll show only Malawi admin boundary and the 5km grid overlay.
    L.control.zoom({ position: "topright" }).addTo(map.current)

    // Legend
    legendRef.current = (L.control as any)({ position: "bottomright" })
    legendRef.current!.onAdd = () => {
      const div = L.DomUtil.create("div", "map-legend")
      div.style.cssText =
        "background: white; padding: 12px 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.12); font-family: Inter, sans-serif; font-size: 12px; min-width: 160px;"
      div.innerHTML = `
        <p style="margin: 0 0 8px 0; font-weight: 700; color: #0d2f3f; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;">False-Onset Risk</p>
        <div style="margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #e36a6a; flex-shrink: 0;"></span>
          <span style="color: #0d2f3f;">High Risk (&gt;60%)</span>
        </div>
        <div style="margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #f2b24a; flex-shrink: 0;"></span>
          <span style="color: #0d2f3f;">Medium Risk (31–60%)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #9fd3a8; flex-shrink: 0;"></span>
          <span style="color: #0d2f3f;">Low Risk (≤30%)</span>
        </div>
      `
      return div
    }
    legendRef.current!.addTo(map.current)

    // API status badge
    statusControlRef.current = (L.control as any)({ position: "topleft" })
    statusControlRef.current!.onAdd = () => {
      const div = L.DomUtil.create("div", "api-status")
      div.id = "api-status-badge"
      div.style.cssText =
        "background: rgba(255,255,255,0.95); padding: 5px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; font-family: Inter, sans-serif; box-shadow: 0 1px 6px rgba(0,0,0,0.12); display: flex; align-items: center; gap: 5px;"
      div.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#f2b24a;"></span> Loading live data…`
      return div
    }
    statusControlRef.current!.addTo(map.current)
  }, [isClient])

  // Update status badge
  useEffect(() => {
    const badge = document.getElementById("api-status-badge")
    if (!badge) return

    if (apiStatus === "live") {
      badge.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;animation:pulse 2s infinite;"></span> Live Data`
    } else if (apiStatus === "pending") {
      badge.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#a78bfa;"></span> Pipeline not run yet`
    } else if (apiStatus === "error") {
      badge.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#e36a6a;"></span> Backend offline`
    }
  }, [apiStatus])

    // Draw / redraw 5km grid cells whenever districtRiskMap or selection changes
  useEffect(() => {
    if (!isClient || !map.current) return

    // Remove old layers
    districtLayers.current.forEach(layer => map.current!.removeLayer(layer))
    districtLayers.current.clear()
    if (boundsGeojsonRef.current) {
      map.current.removeLayer(boundsGeojsonRef.current)
      boundsGeojsonRef.current = null
    }

    // Load country boundary + grid cells and draw
    async function drawGridCells() {
      try {
        // country outline for context
        const country = await fetchBoundaries("country", true)
        if (map.current && country && country.features && country.features.length) {
          const outline = L.geoJSON(country, {
            style: { color: '#0b3a4a', weight: 2, fillOpacity: 0 }
          }).addTo(map.current)
          districtLayers.current.set('country-outline', outline as any)
          // fit map to country
          try { map.current.fitBounds((L.geoJSON(country) as any).getBounds(), { padding: [20,20] }) } catch {}
        }

        // fetch district boundaries as reference overlay
        const districts = await fetchBoundaries("districts", true)
        if (map.current && districts && districts.features) {
          const districtLayer = L.geoJSON(districts, {
            style: { color: '#4b5563', weight: 1.5, fillOpacity: 0, dashArray: '4,4' },
            onEachFeature: (feature: any, layer: any) => {
              const distName = feature.properties?.DISTRICT || feature.properties?.name || '–'
              layer.bindPopup(`<div style="font-family:Inter,sans-serif;font-size:13px;color:#0d2f3f;"><strong>${distName}</strong></div>`)
            }
          }).addTo(map.current)
          districtLayers.current.set('districts-overlay', districtLayer as any)
        }

        const grid = await fetchGridDiagnostics({ limit: 12000, source_grid: 'esri_5km_v1' })
        if (!map.current) return

        const gridLayer = L.geoJSON(grid as any, {
          style: (feature) => {
            const prob = feature?.properties?.false_onset_probability ?? feature?.properties?.false_onset_prob ?? 0
            const color = getFalseOnsetColor(Number(prob))
            const isSelected = (selectedLocation?.grid === feature?.properties?.grid_id) || (selectedLocation?.district === feature?.properties?.district_name)
            return {
              fillColor: color,
              color: isSelected ? '#ffffff' : '#ffffff',
              weight: isSelected ? 2.5 : 0.5,
              opacity: isSelected ? 1 : 0.6,
              fillOpacity: isSelected ? 0.9 : 0.7,
            }
          },
            onEachFeature: (feature: any, featureLayer: any) => {
            const props = feature.properties || {}
            const gid = props.grid_id || props.grid || props.gridId || '–'
            const prob = props.false_onset_probability ?? props.false_onset_prob
            const probText = typeof prob === 'number' ? `${(prob * 100).toFixed(1)}%` : '–'

            featureLayer.bindTooltip(
              `<div style="font-family:Inter,sans-serif;font-size:12px;">
                <strong style="color:#0d2f3f;">Grid ${gid}</strong><br/>
                <span style="color:#6b7a8d;">False-Onset Prob:</span> ${probText}
              </div>`,
              { direction: 'top', sticky: true }
            )

            featureLayer.bindPopup(
              `<div style="font-family:Inter,sans-serif;font-size:13px;color:#0d2f3f;">
                <strong>Grid ${gid}</strong><br/>
                <span style="color:#6b7a8d;font-size:12px;">
                  District: ${props.district_name || '–'}<br/>
                  False-Onset Prob: <strong>${probText}</strong><br/>
                  Onset Prob: <strong>${typeof props.onset_probability === 'number' ? (props.onset_probability * 100).toFixed(1) : '–'}%</strong><br/>
                  Dry Spell Prob: <strong>${typeof props.dry_spell_probability === 'number' ? (props.dry_spell_probability * 100).toFixed(1) : '–'}%</strong>
                </span>
              </div>`
            )

            featureLayer.on('click', async () => {
              const seasons = props.seasons_analyzed ?? 0
              onLocationChange({
                district: props.district_name || "Unknown",
                ta: null,
                taData: null,
                grid: String(gid),
                areaName: props.grid_code || String(gid),
                gridData: {
                  grid_id: String(gid),
                  latitude: Number(props.centroid_lat ?? 0),
                  longitude: Number(props.centroid_lon ?? 0),
                  overall_risk_level: props.overall_risk_level ?? 'Low',
                  false_onset_probability: props.false_onset_probability ?? 0,
                  dry_spell_probability: props.dry_spell_probability ?? 0,
                  onset_probability: props.onset_probability ?? 0,
                  seasons_analyzed: seasons,
                  seasons_with_detected_onset: props.seasons_with_detected_onset ?? 0,
                  first_detected_onset_date: props.first_detected_onset_date ?? null,
                  latest_detected_onset_date: props.latest_detected_onset_date ?? null,
                  false_onset_interpretation: props.false_onset_interpretation ?? "",
                  dry_spell_interpretation: props.dry_spell_interpretation ?? "",
                },
              })
            })

            featureLayer.on('mouseover', function (this: any) { this.setStyle({ weight: 1.5, fillOpacity: 0.92 }) })
            featureLayer.on('mouseout', function (this: any) { this.setStyle({ weight: 0.5, fillOpacity: 0.7 }) })

            districtLayers.current.set(gid, featureLayer)
          }
        }).addTo(map.current)

        boundsGeojsonRef.current = gridLayer
      } catch (err) {
        // fallback: do nothing
      }
    }

    drawGridCells()
  }, [isClient, districtRiskMap, userDistrict, onLocationChange, selectedLocation])

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "400px" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%", minHeight: "400px" }} />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
