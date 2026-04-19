"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { fetchDistrictSummary, getApiBaseUrl, type DistrictSummary } from "../../../lib/algorithm-api"

interface LocationData {
  district: string | null
  traditionalAuthority: string | null
  area: string | null
}

interface FalseOnsetMapProps {
  selectedLocation: LocationData
  onLocationChange: (location: LocationData) => void
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
      attributionControl: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map.current)

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

  // Draw / redraw district layers whenever districtRiskMap or selection changes
  useEffect(() => {
    if (!isClient || !map.current) return

    // Remove old layers
    districtLayers.current.forEach(layer => map.current!.removeLayer(layer))
    districtLayers.current.clear()
    if (boundsGeojsonRef.current) {
      map.current.removeLayer(boundsGeojsonRef.current)
      boundsGeojsonRef.current = null
    }

    // Load boundaries from API
    async function drawDistricts() {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/boundaries/districts?simplified=true`)
        if (!res.ok) throw new Error("Failed to fetch boundaries")
        const geojson = await res.json()

        if (!map.current) return

        const layer = L.geoJSON(geojson, {
          style: (feature) => {
            const name = feature?.properties?.shapeName as string
            const districtData = districtRiskMap[name]
            const prob = districtData?.overall_risk_probability ?? 0
            const color = getFalseOnsetColor(prob)
            const isSelected = selectedLocation.district === name
            const isUser = userDistrict?.toLowerCase() === name?.toLowerCase()

            return {
              fillColor: color,
              color: isSelected ? "#ffffff" : isUser ? "#2563eb" : "#ffffff",
              weight: isSelected ? 3.5 : isUser ? 2.5 : 1,
              opacity: isSelected ? 1 : isUser ? 0.9 : 0.6,
              fillOpacity: isSelected ? 0.92 : 0.7,
            }
          },
          onEachFeature: (feature: any, featureLayer: any) => {
            const name = feature.properties?.shapeName as string
            const districtData = districtRiskMap[name]
            const prob = districtData?.overall_risk_probability
            const label = prob !== undefined ? getRiskLabel(prob) : "No data"
            const probText = prob !== undefined ? `${(prob * 100).toFixed(1)}%` : "–"

            featureLayer.bindTooltip(
              `<div style="font-family:Inter,sans-serif;font-size:12px;">
                <strong style="color:#0d2f3f;">${name}</strong><br/>
                <span style="color:#6b7a8d;">False-Onset Risk:</span> <strong>${label}</strong><br/>
                <span style="color:#6b7a8d;">Probability:</span> ${probText}
              </div>`,
              { direction: "top", sticky: true }
            )

            featureLayer.on("click", () => {
              onLocationChange({ district: name, traditionalAuthority: null, area: null })
            })
            featureLayer.on("mouseover", function (this: any) {
              this.setStyle({ weight: 3, fillOpacity: 0.92 })
            })
            featureLayer.on("mouseout", function (this: any) {
              const isSelected = selectedLocation.district === name
              const isUser = userDistrict?.toLowerCase() === name?.toLowerCase()
              this.setStyle({
                weight: isSelected ? 3.5 : isUser ? 2.5 : 1,
                fillOpacity: isSelected ? 0.92 : 0.7,
              })
            })

            districtLayers.current.set(name, featureLayer)
          },
        }).addTo(map.current!)

        boundsGeojsonRef.current = layer

        // Pan to selected district
        if (selectedLocation.district) {
          const selFeature = geojson.features.find(
            (f: any) => f.properties?.shapeName === selectedLocation.district
          )
          if (selFeature && map.current) {
            const bounds = L.geoJSON(selFeature).getBounds()
            map.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 })
          }
        }
      } catch {
        // fallback: just show Malawi center
      }
    }

    drawDistricts()
  }, [isClient, districtRiskMap, selectedLocation.district, userDistrict, onLocationChange])

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