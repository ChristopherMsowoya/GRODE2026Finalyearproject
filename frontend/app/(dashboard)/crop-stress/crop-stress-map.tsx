"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

import {
  fetchBoundaries,
  type DistrictSummary,
  type GeoJsonFeatureCollection,
  type TraditionalAuthoritySummary,
} from "@/lib/algorithm-api"

interface CropStressMapProps {
  selectedDistrict: string | null
  selectedTA: string | null
  onSelectDistrict: (district: string) => void
  onSelectTA: (taShapeId: string | null) => void
  districtSummaries: DistrictSummary[]
  taSummaries: TraditionalAuthoritySummary[]
}

function colorForProbability(value: number) {
  if (value > 0.6) return "#e06060"
  if (value > 0.3) return "#f3b34c"
  return "#8fcf9e"
}

export default function CropStressMap({
  selectedDistrict,
  selectedTA,
  onSelectDistrict,
  onSelectTA,
  districtSummaries,
  taSummaries,
}: CropStressMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layerGroup = useRef<L.GeoJSON | null>(null)
  const [districtBoundaries, setDistrictBoundaries] = useState<GeoJsonFeatureCollection | null>(null)
  const [taBoundaries, setTaBoundaries] = useState<GeoJsonFeatureCollection | null>(null)
  const [isClient, setIsClient] = useState(false)

  const districtSummaryByName = useMemo(
    () => new Map(districtSummaries.map((summary) => [summary.district, summary])),
    [districtSummaries]
  )
  const taSummaryById = useMemo(
    () => new Map(taSummaries.map((summary) => [summary.shape_id, summary])),
    [taSummaries]
  )

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    const loadBoundaries = async () => {
      const [districtData, taData] = await Promise.all([
        fetchBoundaries("districts", true),
        fetchBoundaries("traditional-authorities", true),
      ])
      setDistrictBoundaries(districtData)
      setTaBoundaries(taData)
    }

    void loadBoundaries()
  }, [])

  useEffect(() => {
    if (!isClient || !mapContainer.current || !districtBoundaries || !taBoundaries) return

    if (!map.current) {
      map.current = L.map(mapContainer.current, {
        center: [-13.2543, 34.3015],
        zoom: 7,
        zoomControl: false,
        attributionControl: true,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map.current)

      L.control.zoom({ position: "topright" }).addTo(map.current)
    }

    if (layerGroup.current) {
      layerGroup.current.remove()
    }

    if (selectedDistrict) {
      const taFeatures = taBoundaries.features.filter((feature) => {
        const summary = taSummaryById.get(feature.properties.shapeID as string)
        return summary?.district === selectedDistrict
      })

      layerGroup.current = L.geoJSON({ type: "FeatureCollection", features: taFeatures } as any, {
        style: (feature) => {
          const summary = taSummaryById.get(feature?.properties?.shapeID)
          const fillColor = colorForProbability(summary?.average_crop_stress_probability ?? 0)
          const isSelected = selectedTA === feature?.properties?.shapeID
          return {
            fillColor,
            color: isSelected ? "#0F2A3D" : "#ffffff",
            weight: isSelected ? 3 : 1,
            opacity: 1,
            fillOpacity: isSelected ? 0.88 : 0.68,
          }
        },
        onEachFeature: (feature, layer) => {
          const shapeId = feature.properties?.shapeID
          const summary = taSummaryById.get(shapeId)
          const taName = summary?.traditional_authority || feature.properties?.shapeName || "Unknown TA"

          layer.on({
            click: () => onSelectTA(shapeId),
            mouseover: () => {
              if (layer instanceof L.Path) layer.setStyle({ weight: 3, fillOpacity: 0.88 })
            },
            mouseout: () => {
              if (layer instanceof L.Path) {
                const isSelected = selectedTA === shapeId
                layer.setStyle({ weight: isSelected ? 3 : 1, fillOpacity: isSelected ? 0.88 : 0.68, color: isSelected ? "#0F2A3D" : "#ffffff" })
              }
            },
          })

          layer.bindTooltip(`${taName}: ${Math.round((summary?.average_crop_stress_probability ?? 0) * 100)}% crop-stress probability`, {
            permanent: false,
            direction: "top",
          })
        },
      }).addTo(map.current)
    } else {
      layerGroup.current = L.geoJSON(districtBoundaries as any, {
        style: (feature) => {
          const districtName = feature?.properties?.shapeName
          const summary = districtSummaryByName.get(districtName)
          const fillColor = colorForProbability(summary?.average_crop_stress_probability ?? 0)
          const isSelected = selectedDistrict === districtName
          return {
            fillColor,
            color: isSelected ? "#0F2A3D" : "#ffffff",
            weight: isSelected ? 3 : 1,
            opacity: 1,
            fillOpacity: isSelected ? 0.88 : 0.68,
          }
        },
        onEachFeature: (feature, layer) => {
          const districtName = feature.properties?.shapeName
          const summary = districtSummaryByName.get(districtName)
          layer.on({
            click: () => {
              onSelectDistrict(districtName)
              onSelectTA(null)
            },
            mouseover: () => {
              if (layer instanceof L.Path) layer.setStyle({ weight: 3, fillOpacity: 0.88 })
            },
            mouseout: () => {
              if (layer instanceof L.Path) {
                const isSelected = selectedDistrict === districtName
                layer.setStyle({ weight: isSelected ? 3 : 1, fillOpacity: isSelected ? 0.88 : 0.68, color: isSelected ? "#0F2A3D" : "#ffffff" })
              }
            },
          })
          layer.bindTooltip(`${districtName}: ${Math.round((summary?.average_crop_stress_probability ?? 0) * 100)}% crop-stress probability`, {
            permanent: false,
            direction: "top",
          })
        },
      }).addTo(map.current)
    }
  }, [
    districtBoundaries,
    districtSummaryByName,
    isClient,
    onSelectDistrict,
    onSelectTA,
    selectedDistrict,
    selectedTA,
    taBoundaries,
    taSummaryById,
  ])

  return <div ref={mapContainer} style={{ width: "100%", height: "100%", minHeight: "600px" }} />
}
