"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Droplets, Thermometer, ZoomIn, ZoomOut, ChevronDown, X, MapPin } from "lucide-react"
import { useUser } from "@/lib/user-context"
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
  onClose
}: {
  selectedLocation: LocationData
  onLocationChange: (location: LocationData) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<'district' | 'ta' | 'area'>('district')
  const [tempLocation, setTempLocation] = useState<LocationData>(selectedLocation)

  const districts = malawiAdministrativeData.districts.map(d => d.name)

  const getTraditionalAuthorities = (districtName: string) => {
    const district = malawiAdministrativeData.districts.find(d => d.name === districtName)
    return district ? district.traditionalAuthorities.map(ta => ta.name) : []
  }

  const getAreas = (districtName: string, taName: string) => {
    const district = malawiAdministrativeData.districts.find(d => d.name === districtName)
    const ta = district?.traditionalAuthorities.find(t => t.name === taName)
    return ta ? ta.areas.map(a => a.name) : []
  }

  const handleDistrictSelect = (district: string) => {
    setTempLocation({ district, traditionalAuthority: null, area: null })
    setStep('ta')
  }

  const handleTASelect = (ta: string) => {
    setTempLocation(prev => ({ ...prev, traditionalAuthority: ta, area: null }))
    setStep('area')
  }

  const handleAreaSelect = (area: string) => {
    setTempLocation(prev => ({ ...prev, area }))
    onLocationChange({ ...tempLocation, area })
    onClose()
  }

  const handleBack = () => {
    if (step === 'area') setStep('ta')
    else if (step === 'ta') setStep('district')
  }

  const handleReset = () => {
    setTempLocation({ district: null, traditionalAuthority: null, area: null })
    setStep('district')
  }

  return (
    <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-[12px] shadow-lg border border-[#e2e8f0] z-50">
      <div className="p-4 border-b border-[#e2e8f0]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0F2A3D]">Select Location</h3>
          <button onClick={onClose} className="text-[#6b7a8d] hover:text-[#0F2A3D]">
            <X className="h-4 w-4" />
          </button>
        </div>
        {tempLocation.district && (
          <div className="mt-2 flex items-center gap-1 text-xs text-[#6b7a8d]">
            <span>{tempLocation.district}</span>
            {tempLocation.traditionalAuthority && (
              <>
                <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                <span>{tempLocation.traditionalAuthority}</span>
                {tempLocation.area && (
                  <>
                    <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                    <span>{tempLocation.area}</span>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto">
        {step === 'district' && (
          <div className="p-2">
            <div className="text-xs font-medium text-[#6b7a8d] mb-2 px-2">Select District</div>
            {districts.map(district => (
              <button
                key={district}
                onClick={() => handleDistrictSelect(district)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[#f8fafb] rounded-md transition-colors"
              >
                {district}
              </button>
            ))}
          </div>
        )}

        {step === 'ta' && tempLocation.district && (
          <div className="p-2">
            <div className="flex items-center gap-2 mb-2 px-2">
              <button onClick={handleBack} className="text-[#6b7a8d] hover:text-[#0F2A3D]">
                ←
              </button>
              <div className="text-xs font-medium text-[#6b7a8d]">Select Traditional Authority</div>
            </div>
            {getTraditionalAuthorities(tempLocation.district).map(ta => (
              <button
                key={ta}
                onClick={() => handleTASelect(ta)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[#f8fafb] rounded-md transition-colors"
              >
                {ta}
              </button>
            ))}
          </div>
        )}

        {step === 'area' && tempLocation.district && tempLocation.traditionalAuthority && (
          <div className="p-2">
            <div className="flex items-center gap-2 mb-2 px-2">
              <button onClick={handleBack} className="text-[#6b7a8d] hover:text-[#0F2A3D]">
                ←
              </button>
              <div className="text-xs font-medium text-[#6b7a8d]">Select Geographical Area</div>
            </div>
            {getAreas(tempLocation.district, tempLocation.traditionalAuthority).map(area => (
              <button
                key={area}
                onClick={() => handleAreaSelect(area)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[#f8fafb] rounded-md transition-colors"
              >
                {area}
              </button>
            ))}
          </div>
        )}
      </div>

      {(tempLocation.district || tempLocation.traditionalAuthority || tempLocation.area) && (
        <div className="p-3 border-t border-[#e2e8f0]">
          <button
            onClick={handleReset}
            className="w-full text-center text-xs text-[#6b7a8d] hover:text-[#0F2A3D] py-1"
          >
            Reset Selection
          </button>
        </div>
      )}
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

  // Set default to user's district on mount
  useEffect(() => {
    if (user?.district && !selectedLocation.district) {
      setSelectedLocation({ district: user.district, traditionalAuthority: null, area: null })
    }
  }, [user?.district, selectedLocation.district])

  const handleLocationChange = (location: LocationData) => {
    setSelectedLocation(location)
  }

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
                />
              )}
            </div>
          </div>
        </div>

        {/* Location Breadcrumb */}
        {(selectedLocation.district || selectedLocation.traditionalAuthority || selectedLocation.area) && (
          <div className="mt-4 flex items-center gap-2 text-sm text-[#6b7a8d]">
            <MapPin className="h-4 w-4" />
            <span className="font-medium text-[#0F2A3D]">{selectedLocation.district}</span>
            {selectedLocation.traditionalAuthority && (
              <>
                <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                <span className="font-medium text-[#0F2A3D]">{selectedLocation.traditionalAuthority}</span>
                {selectedLocation.area && (
                  <>
                    <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                    <span className="font-medium text-[#0F2A3D]">{selectedLocation.area}</span>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        {/* Left Panel: Map */}
        <div className="rounded-[20px] bg-white p-0 shadow-sm border border-[#e9edf1] overflow-hidden" style={{ minHeight: "600px" }}>
          <DynamicMapComponent
            selectedLocation={selectedLocation}
            onLocationChange={handleLocationChange}
            userDistrict={user?.district || ""}
          />
        </div>

        {/* Right Panel: Info Cards */}
        <div className="flex flex-col gap-5">
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
        </div>
      </div>
    </div>
  )
}
