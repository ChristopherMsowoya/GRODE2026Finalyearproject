"use client"

import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { Droplets, Thermometer, ZoomIn, ZoomOut, ChevronDown, X, MapPin, Wifi } from "lucide-react"
import { useUser } from "@/lib/user-context"
import type { DistrictSummary } from "@/lib/algorithm-api"
import malawiDistrictsData from "../../../lib/data/malawiDistricts.json"
import malawiAdministrativeData from "../../../lib/data/malawiAdministrativeData.json"

// Dynamically import Leaflet map to avoid SSR issues
const DynamicMapComponent = dynamic(() => import("./crop-stress-map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-[20px] bg-[#eef2f4] flex items-center justify-center">
      <p className="text-[#6b7a8d]">Loading map...</p>
    </div>
  ),
})

interface InfoCardProps {
  title: string
  value: string | number
  unit?: string
  description: string
  icon: React.ReactNode
  trend?: "up" | "down" | "stable"
  trendValue?: string
}

function InfoCard({ title, value, unit, description, icon, trend, trendValue }: InfoCardProps) {
  return (
    <div
      className="rounded-[20px] bg-white p-6 shadow-sm border border-[#e9edf1] flex flex-col justify-between"
      style={{ minHeight: "200px" }}
    >
      <div>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-[#6b7a8d] uppercase tracking-[0.24em]">{title}</h3>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: "#f0f4f8" }}>
            {icon}
          </div>
        </div>
        <div className="mb-3">
          <p className="text-[32px] font-bold text-[#0d2f3f]">
            {value}
            {unit && <span className="text-[18px] font-semibold text-[#6b7a8d]">{unit}</span>}
          </p>
        </div>
        {trend && trendValue && (
          <p className="text-[12px] font-semibold" style={{
            color: trend === "up" ? "#e06060" : trend === "down" ? "#1F7A63" : "#f3b34c"
          }}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
          </p>
        )}
      </div>
      <p className="text-[13px] leading-relaxed text-[#6b7a8d]">{description}</p>
    </div>
  )
}

interface LocationData {
  district: string | null
  traditionalAuthority: string | null
  area: string | null
}

function LocationSelector({
  selectedLocation,
  onLocationChange,
  onClose,
  liveDistricts
}: {
  selectedLocation: LocationData
  onLocationChange: (location: LocationData) => void
  onClose: () => void
  liveDistricts?: string[]
}) {
  const defaultDistricts = malawiAdministrativeData.districts.map(d => d.name)
  const districts = liveDistricts && liveDistricts.length > 0 ? liveDistricts : defaultDistricts

  const handleDistrictSelect = (district: string) => {
    onLocationChange({ district, traditionalAuthority: null, area: null })
    onClose()
  }

  return (
    <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-[12px] shadow-lg border border-[#e2e8f0] z-50">
      <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0F2A3D]">Select District</h3>
        <button onClick={onClose} className="text-[#6b7a8d] hover:text-[#0F2A3D]">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto p-2">
        {districts.map(district => (
          <button
            key={district}
            onClick={() => handleDistrictSelect(district)}
            className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
              selectedLocation.district === district 
                ? "bg-[#eef2f4] font-semibold text-[#0F2A3D]" 
                : "text-[#6b7a8d] hover:bg-[#f8fafb] hover:text-[#0F2A3D]"
            }`}
          >
            {district}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function CropStressPage() {
  const { user } = useUser()
  const [selectedLocation, setSelectedLocation] = useState<LocationData>({
    district: null,
    traditionalAuthority: null,
    area: null
  })
  const [showLocationSelector, setShowLocationSelector] = useState(false)
  const [liveDistrictData, setLiveDistrictData] = useState<DistrictSummary[]>([])
  const [liveStatus, setLiveStatus] = useState<"loading" | "live" | "error">("loading")

  const handleDistrictDataLoad = useCallback((data: DistrictSummary[]) => {
    setLiveDistrictData(data)
    setLiveStatus("live")
  }, [])

  // Set default to user's district on mount
  useEffect(() => {
    let defaultDistrict = "Lilongwe"
    if (user?.district) {
      const districtMap: Record<string, string> = {
        lilongwe: "Lilongwe",
        blantyre: "Blantyre",
        dedza: "Dedza",
        zomba: "Zomba",
        mchinji: "Mchinji",
        kasungu: "Kasungu",
        mangochi: "Mangochi",
        salima: "Salima",
        nkhotakota: "Nkhotakota"
      }
      defaultDistrict = districtMap[user.district.toLowerCase()] || (user.district.charAt(0).toUpperCase() + user.district.slice(1).toLowerCase())
    }

    if (!selectedLocation.district) {
      setSelectedLocation({ 
        district: defaultDistrict, 
        traditionalAuthority: null, 
        area: null 
      })
    }
  }, [user?.district])

  const handleLocationChange = (location: LocationData) => {
    setSelectedLocation(location)
  }

  // Find live data for selected district
  const liveSelectedDistrict = selectedLocation.district
    ? liveDistrictData.find(d => d.district === selectedLocation.district)
    : null

  // Get data for selected area (most granular level)
  const getSelectedAreaData = () => {
    if (!selectedLocation.district || !selectedLocation.traditionalAuthority || !selectedLocation.area) {
      // Fallback to district level if area not selected
      if (selectedLocation.district) {
        const district = (malawiDistrictsData as any).features.find(
          (f: any) => f.properties.name === selectedLocation.district
        )
        return district ? district.properties : null
      }
      return null
    }

    // Get area-specific data
    const district = malawiAdministrativeData.districts.find(d => d.name === selectedLocation.district)
    const ta = district?.traditionalAuthorities.find(t => t.name === selectedLocation.traditionalAuthority)
    const area = ta?.areas.find(a => a.name === selectedLocation.area)
    return area || null
  }

  const areaData = getSelectedAreaData()

  return (
    <div className="space-y-6 bg-[#eef2f4] px-0 pb-6">
      {/* Header Section */}
      <div className="rounded-[20px] bg-white p-6 md:p-8 shadow-sm border border-[#e9edf1]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-[0.32em] text-[#6b7a8d]">Crop Stress Analysis</p>
            <h1 className="text-4xl font-bold text-[#0d2f3f]">Crop Stress Risk</h1>
            <p className="max-w-2xl text-sm leading-6 text-[#6b7a8d]">
              Monitor agricultural crop stress patterns across Malawi based on rainfall variability and environmental conditions.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-full bg-[#fef3e0] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.24em]" style={{ color: "#d97706" }}>
              Active Monitoring
            </div>
            <div className="relative">
              <button
                onClick={() => setShowLocationSelector(!showLocationSelector)}
                className="flex items-center gap-3 rounded-full border border-[#d8dee4] bg-[#f8fafb] px-4 py-3 hover:bg-[#f0f2f4] transition-colors"
              >
                <MapPin className="h-4 w-4 text-[#0b3a4a]" />
                <span className="text-sm font-medium text-[#0F2A3D]">
                  {selectedLocation.area
                    ? `${selectedLocation.area}`
                    : selectedLocation.traditionalAuthority
                    ? `${selectedLocation.traditionalAuthority}`
                    : selectedLocation.district || 'Select Location'}
                </span>
                <ChevronDown className="h-4 w-4 text-[#6b7a8d]" />
              </button>
              {showLocationSelector && (
                <LocationSelector
                  selectedLocation={selectedLocation}
                  onLocationChange={handleLocationChange}
                  onClose={() => setShowLocationSelector(false)}
                  liveDistricts={liveDistrictData.map(d => d.district).sort()}
                />
              )}
            </div>
          </div>
        </div>


      </div>

      {/* Main Dashboard Grid */}
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        {/* Left Panel: Map */}
        <div className="rounded-[20px] bg-white p-0 shadow-sm border border-[#e9edf1] overflow-hidden" style={{ minHeight: "600px" }}>
          <DynamicMapComponent
            selectedLocation={selectedLocation}
            onLocationChange={handleLocationChange}
            userDistrict={user?.district || ""}
            onDistrictDataLoad={handleDistrictDataLoad}
          />
        </div>

        {/* Right Panel: Info Cards */}
        <div className="flex flex-col gap-5">
          {liveStatus === "live" && liveSelectedDistrict ? (
            <>
              <div className="rounded-[20px] bg-white p-6 shadow-sm border border-[#e9edf1] flex flex-col justify-between" style={{ minHeight: "200px" }}>
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-[14px] font-semibold text-[#6b7a8d] uppercase tracking-[0.24em]">Crop Stress Risk</h3>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: "#f0f4f8" }}>
                      <Droplets className="h-5 w-5" style={{ color: "#0987a6" }} />
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-[32px] font-bold text-[#0d2f3f]">
                      {(liveSelectedDistrict.average_crop_stress_probability * 100).toFixed(1)}
                      <span className="text-[18px] font-semibold text-[#6b7a8d]">%</span>
                    </p>
                  </div>
                  <p className="text-[12px] font-semibold" style={{ color: liveSelectedDistrict.overall_risk_level === 'High' ? '#e06060' : liveSelectedDistrict.overall_risk_level === 'Medium' ? '#f3b34c' : '#22c55e' }}>
                    {liveSelectedDistrict.overall_risk_level === 'High' ? '↑ High' : liveSelectedDistrict.overall_risk_level === 'Medium' ? '→ Medium' : '↓ Low'} overall risk
                  </p>
                </div>
                <p className="text-[13px] leading-relaxed text-[#6b7a8d]">Live crop stress probability for {selectedLocation.district} based on {liveSelectedDistrict.seasons_analyzed} seasons of CHIRPS rainfall analysis.</p>
              </div>

              <div className="rounded-[20px] bg-white p-6 shadow-sm border border-[#e9edf1] flex flex-col justify-between" style={{ minHeight: "200px" }}>
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-[14px] font-semibold text-[#6b7a8d] uppercase tracking-[0.24em]">False-Onset Risk</h3>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: "#fff3e0" }}>
                      <Thermometer className="h-5 w-5" style={{ color: "#d97706" }} />
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-[32px] font-bold text-[#0d2f3f]">
                      {(liveSelectedDistrict.overall_risk_probability * 100).toFixed(1)}
                      <span className="text-[18px] font-semibold text-[#6b7a8d]">%</span>
                    </p>
                  </div>
                  <p className="text-[12px] font-semibold text-[#6b7a8d]">
                    {liveSelectedDistrict.grid_cell_count} grid cells analysed
                  </p>
                </div>
                <p className="text-[13px] leading-relaxed text-[#6b7a8d]">Live false-onset probability for {selectedLocation.district}. Onset detection rate: {(liveSelectedDistrict.onset_detection_rate * 100).toFixed(1)}%.</p>
              </div>

              <div className="flex items-center justify-center gap-2 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] px-4 py-2">
                <Wifi className="h-3.5 w-3.5 text-[#22c55e]" />
                <span className="text-[11px] font-semibold text-[#16a34a]">Live data from GRODE backend</span>
              </div>
            </>
          ) : (
            <>
              <InfoCard
                title="Soil Moisture"
                value={areaData?.soilMoisture || 58}
                unit="%"
                description={`Current soil moisture accumulation in ${selectedLocation.area || selectedLocation.traditionalAuthority || selectedLocation.district || user?.district || 'selected'} region.`}
                icon={<Droplets className="h-5 w-5" style={{ color: "#0987a6" }} />}
                trend="down"
                trendValue="3% from last week"
              />

              <InfoCard
                title="Heat Stress"
                value={areaData ? (areaData.riskLevel === "alert" ? 32 : areaData.riskLevel === "caution" ? 27 : 22) : 27}
                unit="°C"
                description={`Average temperature and corresponding stress degree in ${selectedLocation.area || selectedLocation.traditionalAuthority || selectedLocation.district || user?.district || 'selected'} region.`}
                icon={<Thermometer className="h-5 w-5" style={{ color: "#d97706" }} />}
                trend="up"
                trendValue="2°C above normal"
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
