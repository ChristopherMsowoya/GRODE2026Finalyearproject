"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { FileText, MapPin, Info, Droplets, Sprout, Bell, ChevronDown, X } from "lucide-react"
import { useUser } from "../../../lib/user-context"
import { getDistrictData } from "../../../lib/district-data"
import type { DistrictEnvironmentalData } from "../../../lib/district-data"
import malawiDistrictsData from "../../../lib/data/malawiDistricts.json"
import malawiAdministrativeData from "../../../lib/data/malawiAdministrativeData.json"
const FalseOnsetMap = dynamic(() => import("./false-onset-map"), { ssr: false })

function RiskMeter({ riskLevel = "caution" }: { riskLevel?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 120)
    return () => clearTimeout(timer)
  }, [])

  // Determine meter position and colors based on risk level
  const getRiskPosition = () => {
    switch (riskLevel) {
      case 'alert':
        return { left: "83.33%", color: "#e36a6a", label: "High" }
      case 'caution':
        return { left: "50%", color: "#f2b24a", label: "Medium" }
      case 'optimal':
        return { left: "16.67%", color: "#9fd3a8", label: "Low" }
      default:
        return { left: "50%", color: "#f2b24a", label: "Medium" }
    }
  }

  const riskConfig = getRiskPosition()

  return (
    <div className="mt-6">
      <div className="flex justify-between text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
        <span className="text-[#7cc6a4]">LOW</span>
        <span className="text-[#f2b24a]">MEDIUM</span>
        <span className="text-[#e36a6a]">HIGH</span>
      </div>

      <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-[#eef2f4]">
        <div
          className="absolute inset-y-0 left-0 rounded-l-full transition-all duration-700"
          style={{ width: visible ? "33.33%" : "0%", background: "#9fd3a8" }}
        />
        <div
          className="absolute inset-y-0 transition-all duration-700"
          style={{ left: "33.33%", width: visible ? "33.33%" : "0%", background: "#f2b24a" }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-full transition-all duration-700"
          style={{ width: visible ? "33.33%" : "0%", background: "#e36a6a" }}
        />

        <div
          className="absolute -top-4 -translate-x-1/2 transition-all duration-700"
          style={{ left: visible ? riskConfig.left : "50%" }}
        >
          <div className="h-0 w-0 border-x-[8px] border-x-transparent border-b-[12px]" style={{ borderBottomColor: riskConfig.color }} />
          <div className="mt-1 rounded-full px-2 py-1 text-[10px] font-bold text-white uppercase tracking-wide" style={{ background: riskConfig.color }}>
            {riskConfig.label}
          </div>
        </div>
      </div>
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

function RecommendationCard({ icon: Icon, title, text, iconBg, iconColor, hasButton }: { icon: LucideIcon; title: string; text: string; iconBg: string; iconColor: string; hasButton?: boolean }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  const handleEnableNotifications = () => {
    setNotificationsEnabled(true)
    // Here you would trigger the notification settings panel
    alert("Notifications enabled! You will receive alerts for false-onset risk changes.")
  }

  return (
    <div
      className="rounded-[20px] bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ boxShadow: "0 1px 10px -2px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: iconBg }}>
        <Icon className="h-5 w-5" style={{ color: iconColor }} />
      </div>
      <h3 className="text-[14.5px] font-bold text-[#0F2A3D] mb-2">{title}</h3>
      <p className="text-[13px] leading-relaxed text-[#6b7a8d] mb-4">{text}</p>
      {hasButton && (
        <button
          onClick={handleEnableNotifications}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#f2b24a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e6a43f] disabled:opacity-50"
          disabled={notificationsEnabled}
        >
          <Bell className="h-4 w-4" />
          {notificationsEnabled ? "Notifications Enabled" : "Enable Notifications"}
        </button>
      )}
    </div>
  )
}

const recommendations = [
  {
    icon: Bell,
    iconBg: "#EEF2FF",
    iconColor: "#4f46e5",
    title: "Stay Alert",
    text: "Enable SMS notifications for sudden changes in false-onset probabilities.",
    hasButton: true,
  },
]

export default function FalseOnsetRiskPage() {
  const router = useRouter()
  const { user } = useUser()
  const [selectedLocation, setSelectedLocation] = useState<LocationData>({
    district: null,
    traditionalAuthority: null,
    area: null
  })
  const [districtData, setDistrictData] = useState<DistrictEnvironmentalData | null>(null)
  const [showLocationSelector, setShowLocationSelector] = useState(false)

  // Set default to user's district on mount
  useEffect(() => {
    if (user?.district && !selectedLocation.district) {
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
      const userDistrictName = districtMap[user.district.toLowerCase()] || null
      
      setSelectedLocation({ 
        district: userDistrictName, 
        traditionalAuthority: null, 
        area: null 
      })
      
      // Load district environmental data
      if (userDistrictName) {
        const data = getDistrictData(user.district)
        setDistrictData(data)
      }
    }
  }, [user?.district, selectedLocation.district])

  const handleLocationChange = (location: LocationData) => {
    setSelectedLocation(location)
    // Update district data when district changes
    if (location.district) {
      const data = getDistrictData(location.district.toLowerCase())
      setDistrictData(data)
    }
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

  // Get risk level from district data if no area selected
  const getRiskLevel = () => {
    if (areaData && (areaData as any).riskLevel) {
      return (areaData as any).riskLevel
    }
    if (districtData) {
      return districtData.riskAssessment.falseOnsetRisk === 'high' ? 'alert' 
             : districtData.riskAssessment.falseOnsetRisk === 'medium' ? 'caution' 
             : 'optimal'
    }
    return 'caution'
  }

  // Get risk level text
  const getRiskLevelText = (riskLevel: string) => {
    switch (riskLevel) {
      case 'alert': return 'High'
      case 'caution': return 'Medium'
      case 'optimal': return 'Low'
      default: return 'Unknown'
    }
  }

  // Get risk level color
  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'alert': return '#e36a6a'
      case 'caution': return '#f2b24a'
      case 'optimal': return '#9fd3a8'
      default: return '#9fd3a8'
    }
  }

  return (
    <div className="space-y-6 bg-[#eef2f4] px-0 pb-6 md:px-0">
      <div className="rounded-[20px] bg-white p-6 md:p-8 shadow-sm border border-[#e9edf1]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-[0.32em] text-[#6b7a8d]">False-Onset Risk</p>
            <h1 className="text-4xl font-bold text-[#0F2A3D]">False-Onset Risk</h1>
            <p className="max-w-2xl text-sm leading-6 text-[#6b7a8d]">
              Real-time monitoring of early rainfall patterns across Malawi to prevent premature planting losses.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-full bg-[#fef3e0] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.24em]" style={{ color: "#d97706" }}>
              {getRiskLevelText(getRiskLevel())} Risk Zone
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

      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        {/* Left Panel: Risk Meter and Map */}
        <div className="flex flex-col gap-5">
          <div className="rounded-[20px] bg-white p-7 shadow-sm border border-[#e9edf1]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-[20px] font-bold text-[#0F2A3D]">Current Planting Risk Status</h2>
              <span
                className="inline-flex rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em]"
                style={{ background: "#fef3e0", color: "#d97706" }}
              >
                {areaData ? `${getRiskLevelText(areaData.riskLevel).toUpperCase()} RISK ZONE` : 'MEDIUM RISK ZONE'}
              </span>
            </div>

            <RiskMeter riskLevel={areaData?.riskLevel || 'caution'} />

            <div
              className="mt-7 rounded-[20px] border border-[#f1e6d0] bg-[#fdf8f2] p-5"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff3e0]">
                  <Info className="h-5 w-5 text-[#f0a32e]" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[#8a4d00]">
                    {areaData ? (
                      areaData.riskLevel === 'alert' ?
                        'High risk of false onset. Avoid early planting.' :
                      areaData.riskLevel === 'caution' ?
                        'Moderate risk. Monitor weather closely.' :
                        'Low risk conditions. Safe for planting.'
                    ) : 'Early rains may stop. Be cautious before planting.'}
                  </p>
                  <p className="mt-2 text-[13px] leading-6 text-[#6b7a8d]">
                    {areaData ? (
                      `Current soil moisture: ${areaData.soilMoisture}%. Forecast onset: ${areaData.forecastOnset}. ${
                        areaData.riskLevel === 'alert' ?
                          'The current weather patterns suggest a high probability of a dry spell following initial rains.' :
                        areaData.riskLevel === 'caution' ?
                          'Weather patterns show moderate risk of dry spells. Consider delayed planting.' :
                          'Weather conditions are favorable with low risk of false onset.'
                      }`
                    ) : 'The current weather patterns suggest a high probability of a \'dry spell\' following the initial rains. Planting now may result in crop failure if soil moisture isn\'t sustained.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/planting-guide")}
                className="inline-flex items-center gap-2 rounded-full bg-[#0b3a4a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0e4555]"
              >
                <FileText className="h-4 w-4" />
                View Planting Guide
              </button>
              <button
                onClick={() => router.push("/expert-advice")}
                className="inline-flex items-center gap-2 rounded-full border border-[#d1d9e0] bg-white px-5 py-3 text-sm font-semibold text-[#0b3a4a] transition hover:bg-[#f4f6f8]"
              >
                <MapPin className="h-4 w-4 text-[#0b3a4a]" />
                Locate Expert Advice
              </button>
            </div>
          </div>

          <div className="rounded-[20px] bg-white p-0 shadow-sm border border-[#e9edf1] overflow-hidden" style={{ minHeight: "500px" }}>
            <FalseOnsetMap
              selectedLocation={selectedLocation}
              onLocationChange={handleLocationChange}
              userDistrict={user?.district || null}
            />
          </div>
        </div>

        {/* Right Panel: Stay Alert Card */}
        <div className="flex flex-col gap-5">
          {recommendations.map((item) => (
            <RecommendationCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </div>
  )
}
