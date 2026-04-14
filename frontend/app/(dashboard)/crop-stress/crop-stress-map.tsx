"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import malawiDistricts from "../../../lib/data/malawiDistricts.json"

// Risk color mapping based on cropStress
const RISK_COLORS: Record<string, string> = {
  High: "#e06060",      // Red
  Medium: "#f3b34c",    // Orange
  Low: "#8fcf9e",       // Green
}

interface LocationData {
  district: string | null
  traditionalAuthority: string | null
  area: string | null
}

interface CropStressMapProps {
  selectedLocation: LocationData
  onLocationChange: (location: LocationData) => void
  userDistrict: string
}

export default function CropStressMap({ selectedLocation, onLocationChange, userDistrict }: CropStressMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const [isClient, setIsClient] = useState(false)
  const districtLayers = useRef<Map<string, L.Layer>>(new Map())
  const legendRef = useRef<L.Control | null>(null)

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

      // Add legend (only once during map initialization)
      if (!legendRef.current) {
        const legend = (L.control as any)({ position: "bottomright" })
        legend.onAdd = () => {
          const div = L.DomUtil.create("div", "map-legend")
          div.style.cssText =
            "background: white; padding: 12px 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); font-family: inter; font-size: 12px;"

          div.innerHTML = `
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #0d2f3f;">Crop Stress Level</p>
            <div style="margin-bottom: 6px;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #e06060; margin-right: 6px;"></span>
              <span style="color: #0d2f3f;">High Risk</span>
            </div>
            <div style="margin-bottom: 6px;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #f3b34c; margin-right: 6px;"></span>
              <span style="color: #0d2f3f;">Medium Risk</span>
            </div>
            <div>
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #8fcf9e; margin-right: 6px;"></span>
              <span style="color: #0d2f3f;">Low Risk</span>
            </div>
          `
          return div
        }
        legend.addTo(map.current)
        legendRef.current = legend
      }

      // Add Malawi district boundaries
      L.geoJSON(malawiDistricts as any, {
        style: (feature) => {
          const districtName = feature?.properties?.name
          const isSelected = selectedLocation.district === districtName
          const isUserDistrict = userDistrict === districtName

          return {
            color: isSelected ? "#ffffff" : isUserDistrict ? "#2563eb" : "#666666",
            weight: isSelected ? 3 : isUserDistrict ? 2 : 1,
            opacity: isSelected ? 1 : isUserDistrict ? 0.8 : 0.6,
            fillColor: RISK_COLORS[feature?.properties?.cropStress] || "#cccccc",
            fillOpacity: isSelected ? 0.9 : isUserDistrict ? 0.7 : 0.5,
          }
        },
        onEachFeature: (feature, layer: any) => {
          const districtName = feature.properties.name
          districtLayers.current.set(districtName, layer)

          layer.on({
            click: () => {
              onLocationChange({ district: districtName, traditionalAuthority: null, area: null })
            },
            mouseover: () => {
              if (layer.setStyle) {
                layer.setStyle({
                  weight: 3,
                  opacity: 1,
                  fillOpacity: 0.9,
                })
              }
            },
            mouseout: () => {
              if (layer.setStyle) {
                const isSelected = selectedLocation.district === districtName
                const isUserDistrict = userDistrict === districtName
                layer.setStyle({
                  weight: isSelected ? 3 : isUserDistrict ? 2 : 1,
                  opacity: isSelected ? 1 : isUserDistrict ? 0.8 : 0.6,
                  fillOpacity: isSelected ? 0.9 : isUserDistrict ? 0.7 : 0.5,
                })
              }
            }
          })

          layer.bindTooltip(districtName, {
            permanent: false,
            direction: 'top'
          })
        }
      }).addTo(map.current!)

      // Zoom to selected district if one is selected
      if (selectedLocation.district) {
        const selectedFeature = (malawiDistricts as any).features.find(
          (f: any) => f.properties.name === selectedLocation.district
        )
        if (selectedFeature && map.current) {
          const bounds = L.geoJSON(selectedFeature).getBounds()
          map.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 })
        }
      }
    }

    return () => {
      // Cleanup is optional for Leaflet maps
    }
  }, [isClient, selectedLocation.district, userDistrict, onLocationChange])

  // Update district styles when selection changes
  useEffect(() => {
    districtLayers.current.forEach((layer, districtName) => {
      const isSelected = selectedLocation.district === districtName
      const isUserDistrict = userDistrict === districtName

      if (layer instanceof L.Path) {
        layer.setStyle({
          color: isSelected ? "#ffffff" : isUserDistrict ? "#2563eb" : "#666666",
          weight: isSelected ? 3 : isUserDistrict ? 2 : 1,
          opacity: isSelected ? 1 : isUserDistrict ? 0.8 : 0.6,
          fillOpacity: isSelected ? 0.9 : isUserDistrict ? 0.7 : 0.5,
        })
      }
    })
  }, [selectedLocation.district, userDistrict])

  return <div ref={mapContainer} style={{ width: "100%", height: "100%", minHeight: "600px" }} />
}
