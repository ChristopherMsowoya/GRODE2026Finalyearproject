"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import malawiDistrictsData from "../../../lib/data/malawiDistricts.json"

interface LocationData {
  district: string | null
  traditionalAuthority: string | null
  area: string | null
}

interface FalseOnsetMapProps {
  selectedLocation: LocationData
  onLocationChange: (location: LocationData) => void
  userDistrict?: string | null
}

// Risk color mapping based on riskLevel
const RISK_COLORS: Record<string, string> = {
  alert: "#e36a6a",      // Red - High Risk
  caution: "#f2b24a",    // Orange - Medium Risk
  optimal: "#9fd3a8",    // Green - Low Risk
}

export default function FalseOnsetMap({ selectedLocation, onLocationChange, userDistrict }: FalseOnsetMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const [isClient, setIsClient] = useState(false)
  const districtLayers = useRef<Map<string, L.GeoJSON<any>>>(new Map())
  const legendRef = useRef<L.Control<any> | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !mapContainer.current) return

    // Initialize map
    if (!map.current) {
      map.current = L.map(mapContainer.current, {
        center: [-13.2543, 34.3015],
        zoom: 7,
        zoomControl: false,
        attributionControl: true,
      })

      // Add light base layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map.current)

      // Custom zoom controls positioned in top-right
      const zoomControl = L.control.zoom({
        position: "topright",
      })
      zoomControl.addTo(map.current)

      // Add legend once on map initialization
      legendRef.current = (L.control as any)({ position: "bottomright" })
      if (legendRef.current) {
        legendRef.current.onAdd = () => {
          const div = L.DomUtil.create("div", "map-legend")
          div.style.cssText =
            "background: white; padding: 12px 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); font-family: inter; font-size: 12px;"

          div.innerHTML = `
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #0d2f3f;">False-Onset Risk Level</p>
            <div style="margin-bottom: 6px;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #e36a6a; margin-right: 6px;"></span>
              <span style="color: #0d2f3f;">High Risk</span>
            </div>
            <div style="margin-bottom: 6px;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #f2b24a; margin-right: 6px;"></span>
              <span style="color: #0d2f3f;">Medium Risk</span>
            </div>
            <div>
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #9fd3a8; margin-right: 6px;"></span>
              <span style="color: #0d2f3f;">Low Risk</span>
            </div>
          `
          return div
        }
        legendRef.current.addTo(map.current!)
      }
    }

    // Clear existing layers
    districtLayers.current.forEach(layer => map.current!.removeLayer(layer))
    districtLayers.current.clear()

    // Add Malawi districts with false-onset risk visualization
    const geoJsonLayer = L.geoJSON(malawiDistrictsData as any, {
      style: (feature) => {
        const districtName = feature!.properties.name
        const riskLevel = feature!.properties.riskLevel
        const color = RISK_COLORS[riskLevel] || "#9fd3a8"

        const isSelected = selectedLocation.district === districtName
        const isUserDistrict = userDistrict === districtName

        return {
          fillColor: color,
          color: isSelected ? "#ffffff" : isUserDistrict ? "#2563eb" : "#ffffff",
          weight: isSelected ? 3 : isUserDistrict ? 2 : 1,
          opacity: isSelected ? 1 : isUserDistrict ? 0.8 : 0.6,
          fillOpacity: isSelected ? 0.9 : 0.7,
        }
      },
      onEachFeature: (feature: any, layer: any) => {
        const districtName = feature.properties.name

        layer.on('click', () => {
          onLocationChange({ district: districtName, traditionalAuthority: null, area: null })
        })

        // Add hover effects
        layer.on('mouseover', function(this: any) {
          this.setStyle({
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9,
          })
        })

        layer.on('mouseout', function(this: any) {
          const isSelected = selectedLocation.district === districtName
          const isUserDistrict = userDistrict === districtName
          this.setStyle({
            weight: isSelected ? 3 : isUserDistrict ? 2 : 1,
            opacity: isSelected ? 1 : isUserDistrict ? 0.8 : 0.6,
            fillOpacity: isSelected ? 0.9 : 0.7,
          })
        })

        districtLayers.current.set(districtName, layer)
      }
    }).addTo(map.current!)

    // Zoom to selected district if one is selected
    if (selectedLocation.district) {
      const selectedFeature = (malawiDistrictsData as any).features.find(
        (f: any) => f.properties.name === selectedLocation.district
      )
      if (selectedFeature && map.current) {
        const bounds = L.geoJSON(selectedFeature).getBounds()
        map.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 })
      }
    }

    return () => {
      // Cleanup is optional for Leaflet maps
    }
  }, [isClient, selectedLocation.district, userDistrict, onLocationChange])

  // Update layer styles when selection changes
  useEffect(() => {
    districtLayers.current.forEach((layer, districtName) => {
      const isSelected = selectedLocation.district === districtName
      const isUserDistrict = userDistrict === districtName

      layer.setStyle({
        color: isSelected ? "#ffffff" : isUserDistrict ? "#2563eb" : "#ffffff",
        weight: isSelected ? 3 : isUserDistrict ? 2 : 1,
        opacity: isSelected ? 1 : isUserDistrict ? 0.8 : 0.6,
        fillOpacity: isSelected ? 0.9 : 0.7,
      })
    })
  }, [selectedLocation.district, userDistrict])

  return <div ref={mapContainer} style={{ width: "100%", height: "100%", minHeight: "400px" }} />
}