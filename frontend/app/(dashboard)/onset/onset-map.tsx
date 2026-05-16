"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { fetchDistrictSummary, fetchGridDiagnostics, fetchBoundaries, type DistrictSummary } from "../../../lib/algorithm-api"
import type { SelectedLocation } from "@/components/location-selector"

interface OnsetMapProps {
  selectedLocation: SelectedLocation | null
  onLocationChange: (location: SelectedLocation) => void
  userDistrict?: string | null
  onDistrictDataLoad?: (data: DistrictSummary[]) => void
}

function getOnsetColor(prob: number): string {
  const pct = prob * 100
  if (pct > 60) return "#1F7A63" // High - Green
  if (pct > 30) return "#facc15" // Moderate - Yellow
  return "#e36a6a"               // Low - Red
}

export default function OnsetMap({
  selectedLocation,
  onLocationChange,
  userDistrict,
  onDistrictDataLoad,
}: OnsetMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [apiStatus, setApiStatus] = useState<"loading" | "live" | "pending" | "error">("loading")
  const [showDistrictLabels, setShowDistrictLabels] = useState(true)
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

        if ((response as any).pipeline_status === "not_run") {
          setApiStatus("pending")
          onDistrictDataLoad?.([])
          return
        }

        if (response.districts.length === 0) {
          setApiStatus("error")
          onDistrictDataLoad?.([])
          return
        }

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

    L.control.zoom({ position: "topright" }).addTo(map.current)

    // Legend — colors only, no percentages
    legendRef.current = (L.control as any)({ position: "bottomright" })
    legendRef.current!.onAdd = () => {
      const div = L.DomUtil.create("div", "map-legend")
      div.style.cssText =
        "background: white; padding: 12px 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.12); font-family: Inter, sans-serif; font-size: 12px; min-width: 140px;"
      div.innerHTML = `
        <p style="margin: 0 0 8px 0; font-weight: 700; color: #0d2f3f; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;">Onset Probability</p>
        <div style="margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 18px; height: 12px; border-radius: 3px; background: #1F7A63; flex-shrink: 0;"></span>
          <span style="color: #0d2f3f; font-weight: 600;">High</span>
        </div>
        <div style="margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 18px; height: 12px; border-radius: 3px; background: #facc15; flex-shrink: 0;"></span>
          <span style="color: #0d2f3f; font-weight: 600;">Moderate</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 18px; height: 12px; border-radius: 3px; background: #e36a6a; flex-shrink: 0;"></span>
          <span style="color: #0d2f3f; font-weight: 600;">Low</span>
        </div>
      `
      return div
    }
    legendRef.current!.addTo(map.current)

    // API status badge
    statusControlRef.current = (L.control as any)({ position: "bottomleft" })
    statusControlRef.current!.onAdd = () => {
      const div = L.DomUtil.create("div", "api-status")
      div.id = "api-status-badge-onset"
      div.style.cssText =
        "background: rgba(255,255,255,0.95); padding: 5px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; font-family: Inter, sans-serif; box-shadow: 0 1px 6px rgba(0,0,0,0.12); display: flex; align-items: center; gap: 5px;"
      div.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#f2b24a;"></span> Loading live data…`
      return div
    }
    statusControlRef.current!.addTo(map.current)
  }, [isClient])

  // Update status badge
  useEffect(() => {
    const badge = document.getElementById("api-status-badge-onset")
    if (!badge) return

    if (apiStatus === "live") {
      badge.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;animation:pulse 2s infinite;"></span> Live Data`
    } else if (apiStatus === "pending") {
      badge.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#a78bfa;"></span> Pipeline not run yet`
    } else if (apiStatus === "error") {
      badge.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#e36a6a;"></span> Backend offline`
    }
  }, [apiStatus])

  // Map zooming effect when selection changes
  useEffect(() => {
    if (!map.current || !selectedLocation) return
    
    if (selectedLocation.gridData?.latitude && selectedLocation.gridData?.longitude) {
      map.current.setView([selectedLocation.gridData.latitude, selectedLocation.gridData.longitude], 12, { animate: true })
      return
    }
  }, [selectedLocation])

  // Draw / redraw 5km grid cells whenever the active selection or label toggle changes
  useEffect(() => {
    if (!isClient || !map.current) return

    // Remove old layers
    districtLayers.current.forEach(layer => map.current!.removeLayer(layer))
    districtLayers.current.clear()
    if (boundsGeojsonRef.current) {
      map.current.removeLayer(boundsGeojsonRef.current)
      boundsGeojsonRef.current = null
    }

    async function drawGridCells() {
      try {
        const country = await fetchBoundaries("country", true)
        if (map.current && country && country.features && country.features.length) {
          const outline = L.geoJSON(country, {
            style: { color: '#0b3a4a', weight: 2, fillOpacity: 0 }
          }).addTo(map.current)
          districtLayers.current.set('country-outline', outline as any)
        }

        const districts = await fetchBoundaries("districts", true)
        if (map.current && districts && districts.features) {
          const districtLayer = L.geoJSON(districts, {
            style: { color: '#111827', weight: 1.1, fillOpacity: 0, opacity: 0.8, dashArray: '3,4' },
            onEachFeature: (feature: any, layer: any) => {
              const distName = feature.properties?.DISTRICT || feature.properties?.shapeName || feature.properties?.name || 'District'
              layer.bindPopup(`<div style="font-family:Inter,sans-serif;font-size:13px;color:#0d2f3f;"><strong>${distName}</strong></div>`)
              if (showDistrictLabels) {
                layer.bindTooltip(distName, {
                  permanent: true,
                  direction: "center",
                  className: "district-map-label",
                })
              }
            }
          }).addTo(map.current)
          districtLayers.current.set('districts-overlay', districtLayer as any)

          const activeDistrict = selectedLocation?.district || userDistrict || "Lilongwe"
          if (!selectedLocation?.gridData) {
            const matchedFeature = districts.features.find((f: any) => {
              const name = f.properties?.DISTRICT || f.properties?.name || ''
              return name.toLowerCase() === activeDistrict.toLowerCase()
            })
            if (matchedFeature) {
              const bounds = (L.geoJSON(matchedFeature as any) as any).getBounds()
              try { map.current.fitBounds(bounds, { padding: [20, 20] }) } catch {}
            } else if (country) {
              try { map.current.fitBounds((L.geoJSON(country as any) as any).getBounds(), { padding: [20, 20] }) } catch {}
            }
          }
        }

        const grid = await fetchGridDiagnostics({ limit: 12000, source_grid: 'esri_5km_v1' })
        if (!map.current) return

        const gridLayer = L.geoJSON(grid as any, {
          style: (feature) => {
            const prob = feature?.properties?.onset_probability ?? feature?.properties?.onset_prob ?? 0
            const color = getOnsetColor(Number(prob))
            const isSelected = (selectedLocation?.grid === feature?.properties?.grid_id)
            return {
              fillColor: color,
              color: isSelected ? '#ffffff' : '#334155',
              weight: isSelected ? 2.5 : 0.35,
              opacity: isSelected ? 1 : 0.55,
              fillOpacity: isSelected ? 0.92 : 0.72,
            }
          },
            onEachFeature: (feature: any, featureLayer: any) => {
            const props = feature.properties || {}
            const gid = props.grid_id || props.grid || props.gridId || '–'
            const prob = props.onset_probability ?? props.onset_prob
            const probText = typeof prob === 'number' ? `${(prob * 100).toFixed(1)}%` : '–'

            featureLayer.bindTooltip(
              `<div style="font-family:Inter,sans-serif;font-size:12px;">
                <strong style="color:#0d2f3f;">Grid ${gid}</strong><br/>
                <span style="color:#6b7a8d;">Onset Prob:</span> ${probText}
              </div>`,
              { direction: 'top', sticky: true }
            )

            featureLayer.bindPopup(
              `<div style="font-family:Inter,sans-serif;font-size:13px;color:#0d2f3f;">
                <strong>Grid ${gid}</strong><br/>
                <span style="color:#6b7a8d;font-size:12px;">
                  District: ${props.district_name || '–'}<br/>
                  Onset Prob: <strong>${probText}</strong><br/>
                  False-Onset Prob: <strong>${typeof props.false_onset_probability === 'number' ? (props.false_onset_probability * 100).toFixed(1) : '–'}%</strong><br/>
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

            featureLayer.on('mouseover', function (this: any) { this.setStyle({ weight: 1.5, fillOpacity: 0.95 }) })
            featureLayer.on('mouseout', function (this: any) { this.setStyle({ weight: 0.35, fillOpacity: 0.72 }) })

            districtLayers.current.set(gid, featureLayer)
          }
        }).addTo(map.current)

        boundsGeojsonRef.current = gridLayer
      } catch (err) {
        // fallback: do nothing
      }
    }

    drawGridCells()
  }, [isClient, userDistrict, onLocationChange, selectedLocation?.district, selectedLocation?.grid, showDistrictLabels])

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "500px" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%", minHeight: "500px" }} />
      {/* Hide/Show District Names button — left corner */}
      <button
        onClick={() => setShowDistrictLabels((value) => !value)}
        className="absolute left-3 top-3 z-[700] rounded-lg border border-white/70 bg-white/95 px-3 py-2 text-[12px] font-bold text-[#0F2A3D] shadow-sm"
      >
        {showDistrictLabels ? "Hide District Names" : "Show District Names"}
      </button>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .district-map-label {
          border: 0;
          border-radius: 999px;
          background: rgba(15, 42, 61, 0.78);
          color: white;
          font-family: Inter, sans-serif;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.04em;
          box-shadow: 0 1px 8px rgba(15,42,61,0.18);
          padding: 2px 7px;
        }
      `}</style>
    </div>
  )
}
