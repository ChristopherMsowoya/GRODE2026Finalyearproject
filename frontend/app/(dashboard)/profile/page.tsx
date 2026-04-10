"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  User, Mail, Phone, MapPin, Sprout, Bell, BellOff,
  LogOut, Check, Pencil, X, Save, Navigation, Loader2,
  Shield, ToggleLeft, ToggleRight, AlertTriangle,
} from "lucide-react"
import { useUser, getInitials, requestBrowserNotifications } from "@/lib/user-context"
import type { UserProfile } from "@/lib/user-context"
import Link from "next/link"

// ─── Constants ────────────────────────────────────────────────────────────────
const DISTRICTS = [
  "Balaka","Blantyre","Chikwawa","Chiradzulu","Chitipa","Dedza","Dowa",
  "Karonga","Kasungu","Likoma","Lilongwe","Machinga","Mangochi","Mchinji",
  "Mulanje","Mwanza","Mzimba","Neno","Nkhata Bay","Nkhotakota","Nsanje",
  "Ntcheu","Ntchisi","Phalombe","Rumphi","Salima","Thyolo","Zomba",
].map((d) => ({ value: d.toLowerCase().replace(/\s/g, "-"), label: d }))

const CROPS = [
  "Maize","Sorghum","Groundnuts","Soybean","Cassava",
  "Sweet Potato","Rice","Sunflower","Tobacco","Beans",
]

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex-shrink-0">
      {enabled
        ? <ToggleRight className="h-6 w-7 transition-colors duration-200" style={{ color: "#1F7A63" }} />
        : <ToggleLeft className="h-6 w-7 text-[#c0cad6] transition-colors duration-200" />}
    </button>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Card({ title, icon: Icon, iconBg, iconColor, children }: {
  title: string; icon: React.ElementType; iconBg: string; iconColor: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-white p-6" style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: iconBg }}>
          <Icon className="h-4.5 w-4.5" style={{ color: iconColor }} />
        </div>
        <h2 className="text-[16px] font-bold" style={{ color: "#0F2A3D" }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ─── Editable input ───────────────────────────────────────────────────────────
function EditInput({ label, value, onChange, type = "text", icon: Icon }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; icon: React.ElementType
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12.5px] font-semibold" style={{ color: "#6b7a8d" }}>{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: focused ? "#1F7A63" : "#6b7a8d" }} />
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full rounded-xl py-2.5 pl-10 pr-4 text-[13.5px] outline-none transition-all duration-200 bg-white"
          style={{ border: `1.5px solid ${focused ? "#1F7A63" : "#e2e8f0"}`, color: "#1a2332" }}
        />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, updateProfile, logout } = useUser()
  const router = useRouter()

  const [editMode, setEditMode] = useState(false)
  const [saved, setSaved] = useState(false)
  const [locating, setLocating] = useState(false)

  // Editable fields
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [district, setDistrict] = useState("")
  const [locationLabel, setLocationLabel] = useState("")
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [crops, setCrops] = useState<string[]>([])
  const [role, setRole] = useState<"farmer" | "expert">("farmer")

  // Notifications
  const [notifications, setNotifications] = useState({
    riskAlerts: true,
    weeklyReport: true,
    onsetAlerts: true,
    systemUpdates: false,
  })

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName)
      setLastName(user.lastName)
      setPhone(user.phone ?? "")
      setDistrict(user.district)
      setLocationLabel(user.location?.label ?? "")
      if (user.location?.lat && user.location?.lng) {
        setLocationCoords({ lat: user.location.lat, lng: user.location.lng })
      }
      setCrops(user.crops)
      setRole(user.role)
      setNotifications(user.notifications)
    }
  }, [user])

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <AlertTriangle className="h-12 w-12" style={{ color: "#F4A261" }} />
        <p className="text-[16px] font-semibold" style={{ color: "#1a2332" }}>No account found</p>
        <Link href="/create-account"
          className="rounded-xl px-6 py-3 text-[13.5px] font-bold text-white"
          style={{ background: "linear-gradient(135deg,#0F2A3D,#1F7A63)" }}>
          Create Account
        </Link>
      </div>
    )
  }

  const districtLabel = DISTRICTS.find((d) => d.value === district)?.label ?? district
  const initials = getInitials(user)

  const detectLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationLabel(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`)
        setLocating(false)
      },
      () => setLocating(false)
    )
  }

  const toggleCrop = (c: string) =>
    setCrops((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c])

  const handleSave = () => {
    updateProfile({
      firstName, lastName, phone, district, role, crops,
      location: locationCoords
        ? { lat: locationCoords.lat, lng: locationCoords.lng, label: locationLabel }
        : locationLabel ? { lat: null, lng: null, label: locationLabel } : null,
      notifications,
    })
    setEditMode(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleCancelEdit = () => {
    // Reset to saved values
    setFirstName(user.firstName)
    setLastName(user.lastName)
    setPhone(user.phone ?? "")
    setDistrict(user.district)
    setLocationLabel(user.location?.label ?? "")
    setCrops(user.crops)
    setRole(user.role)
    setEditMode(false)
  }

  const handleNotificationToggle = async (key: keyof typeof notifications) => {
    const newVal = !notifications[key]
    const updated = { ...notifications, [key]: newVal }
    setNotifications(updated)
    updateProfile({ notifications: updated })

    // If turning on any alert, request browser notification permission
    if (newVal && key !== "systemUpdates") {
      await requestBrowserNotifications(districtLabel)
    }
  }

  const handleLogout = () => {
    logout()
    router.push("/create-account")
  }

  const DISTRICT_LABELS: Record<string, string> = Object.fromEntries(
    DISTRICTS.map((d) => [d.value, d.label])
  )

  return (
    <div className="space-y-6 max-w-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight" style={{ color: "#0F2A3D" }}>My Profile</h1>
          <p className="mt-1 text-[14px]" style={{ color: "#6b7a8d" }}>
            Manage your account details, location, and notification preferences.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold"
              style={{ background: "rgba(31,122,99,0.1)", color: "#1F7A63" }}>
              <Check className="h-4 w-4" />Changes saved
            </span>
          )}
          {!editMode ? (
            <button onClick={() => setEditMode(true)}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white transition-all duration-200 hover:opacity-90 hover:shadow-md active:scale-95"
              style={{ background: "linear-gradient(135deg,#0F2A3D 0%,#1F7A63 100%)" }}>
              <Pencil className="h-4 w-4" />Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleCancelEdit}
                className="flex items-center gap-2 rounded-xl border px-5 py-2.5 text-[13px] font-semibold transition-all hover:bg-[#f0f4f8]"
                style={{ border: "1.5px solid #e2e8f0", color: "#1a2332" }}>
                <X className="h-4 w-4" />Cancel
              </button>
              <button onClick={handleSave}
                className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13.5px] font-bold text-white transition-all hover:opacity-90 hover:shadow-md active:scale-95"
                style={{ background: "linear-gradient(135deg,#0F2A3D 0%,#1F7A63 100%)" }}>
                <Save className="h-4 w-4" />Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">

        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Identity card */}
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}>
            {/* Banner */}
            <div className="h-20 w-full" style={{ background: "linear-gradient(135deg,#0F2A3D 0%,#1a3d54 60%,#1F7A63 100%)" }} />
            <div className="px-6 pb-6">
              <div className="-mt-10 mb-4 flex items-end justify-between">
                <div className="flex h-20 w-20 items-center justify-center rounded-full font-extrabold text-white text-[26px] select-none ring-4 ring-white"
                  style={{ background: "linear-gradient(135deg,#0F2A3D,#1F7A63)" }}>
                  {initials}
                </div>
                <span className="rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide"
                  style={{
                    background: user.role === "farmer" ? "rgba(244,162,97,0.12)" : "rgba(31,122,99,0.1)",
                    color: user.role === "farmer" ? "#c07830" : "#1F7A63",
                  }}>
                  {user.role === "farmer" ? "🌾 Farmer" : "🔬 Agronomist"}
                </span>
              </div>

              {editMode ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <EditInput label="First Name" value={firstName} onChange={setFirstName} icon={User} />
                    <EditInput label="Last Name" value={lastName} onChange={setLastName} icon={User} />
                  </div>
                  <EditInput label="Phone Number" value={phone} onChange={setPhone} type="tel" icon={Phone} />

                  {/* Role selector */}
                  <div>
                    <p className="text-[12.5px] font-semibold mb-2" style={{ color: "#6b7a8d" }}>Role</p>
                    <div className="flex gap-2">
                      {(["farmer", "expert"] as const).map((r) => (
                        <button key={r} type="button" onClick={() => setRole(r)}
                          className="flex-1 rounded-xl py-2 text-[13px] font-semibold transition-all"
                          style={role === r
                            ? { background: "linear-gradient(135deg,#0F2A3D,#1F7A63)", color: "#fff", border: "1.5px solid transparent" }
                            : { background: "#f0f4f8", color: "#6b7a8d", border: "1.5px solid #e2e8f0" }}>
                          {r === "farmer" ? "🌾 Farmer" : "🔬 Agronomist"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-[20px] font-extrabold" style={{ color: "#0F2A3D" }}>
                    {user.firstName} {user.lastName}
                  </h3>
                  {[
                    { icon: Mail, val: user.email },
                    ...(user.phone ? [{ icon: Phone, val: user.phone }] : []),
                  ].map(({ icon: Icon, val }, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#6b7a8d" }} />
                      <span className="text-[13px]" style={{ color: "#6b7a8d" }}>{val}</span>
                    </div>
                  ))}
                  <p className="text-[11.5px]" style={{ color: "#6b7a8d" }}>
                    Member since {new Date(user.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          <Card title="Location" icon={MapPin} iconBg="rgba(31,122,99,0.1)" iconColor="#1F7A63">
            {editMode ? (
              <div className="space-y-4">
                {/* District dropdown */}
                <div>
                  <label className="text-[12.5px] font-semibold block mb-1.5" style={{ color: "#6b7a8d" }}>District</label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b7a8d]" />
                    <select value={district} onChange={(e) => setDistrict(e.target.value)}
                      className="w-full appearance-none rounded-xl py-2.5 pl-10 pr-8 text-[13.5px] outline-none bg-white"
                      style={{ border: "1.5px solid #e2e8f0", color: "#1a2332" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#1F7A63")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}>
                      {DISTRICTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b7a8d]"
                      viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L2 4h8L6 8z" /></svg>
                  </div>
                </div>

                {/* Specific location */}
                <div>
                  <label className="text-[12.5px] font-semibold block mb-1.5" style={{ color: "#6b7a8d" }}>Specific Location / Village</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b7a8d]" />
                      <input type="text" placeholder="e.g. Area 49, Lilongwe" value={locationLabel}
                        onChange={(e) => setLocationLabel(e.target.value)}
                        className="w-full rounded-xl py-2.5 pl-10 pr-4 text-[13.5px] outline-none bg-white"
                        style={{ border: "1.5px solid #e2e8f0", color: "#1a2332" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#1F7A63")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")} />
                    </div>
                    <button type="button" onClick={detectLocation} disabled={locating}
                      className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold transition-all flex-shrink-0"
                      style={{ background: "rgba(31,122,99,0.1)", color: "#1F7A63", border: "1.5px solid rgba(31,122,99,0.25)" }}>
                      {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                      GPS
                    </button>
                  </div>
                  {locationCoords && (
                    <p className="mt-1.5 text-[11.5px] flex items-center gap-1.5" style={{ color: "#1F7A63" }}>
                      <Check className="h-3.5 w-3.5" />
                      {locationCoords.lat.toFixed(5)}, {locationCoords.lng.toFixed(5)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: "#f8fafd" }}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: "rgba(31,122,99,0.12)" }}>
                    <MapPin className="h-4 w-4" style={{ color: "#1F7A63" }} />
                  </div>
                  <div>
                    <p className="text-[13.5px] font-bold" style={{ color: "#1a2332" }}>{DISTRICT_LABELS[user.district] ?? user.district} District</p>
                    {user.location?.label && (
                      <p className="text-[12px]" style={{ color: "#6b7a8d" }}>{user.location.label}</p>
                    )}
                    {user.location?.lat && user.location?.lng && (
                      <p className="text-[11px] font-mono" style={{ color: "#6b7a8d" }}>
                        {user.location.lat.toFixed(5)}, {user.location.lng.toFixed(5)}
                      </p>
                    )}
                  </div>
                </div>
                {!user.location && (
                  <p className="text-[12px]" style={{ color: "#6b7a8d" }}>
                    No specific location saved. Click Edit Profile to add your GPS or village name for more precise alerts.
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ── Right column ────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Crops */}
          <Card title="Primary Crops" icon={Sprout} iconBg="rgba(31,122,99,0.1)" iconColor="#1F7A63">
            {editMode ? (
              <div className="flex flex-wrap gap-2">
                {CROPS.map((crop) => {
                  const active = crops.includes(crop)
                  return (
                    <button key={crop} type="button" onClick={() => toggleCrop(crop)}
                      className="rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-all duration-200 flex items-center gap-1"
                      style={active
                        ? { background: "linear-gradient(135deg,#0F2A3D,#1F7A63)", color: "#fff", border: "1.5px solid transparent" }
                        : { background: "#f0f4f8", color: "#6b7a8d", border: "1.5px solid #e2e8f0" }}>
                      {active && <Check className="h-3 w-3" />}{crop}
                    </button>
                  )
                })}
              </div>
            ) : (
              <>
                {user.crops.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.crops.map((c) => (
                      <span key={c} className="rounded-full px-4 py-1.5 text-[12.5px] font-semibold"
                        style={{ background: "rgba(31,122,99,0.1)", color: "#1F7A63", border: "1.5px solid rgba(31,122,99,0.2)" }}>
                        {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px]" style={{ color: "#6b7a8d" }}>No crops selected yet.</p>
                )}
              </>
            )}
          </Card>

          {/* Notifications */}
          <Card title="Notifications" icon={Bell} iconBg="rgba(244,162,97,0.12)" iconColor="#F4A261">
            <div className="space-y-4 divide-y divide-[#f0f4f8]">
              {([
                {
                  key: "riskAlerts" as const,
                  label: "Risk Alerts",
                  desc: `False-onset & crop stress alerts for ${DISTRICT_LABELS[user.district] ?? user.district}`,
                },
                {
                  key: "onsetAlerts" as const,
                  label: "Onset Date Alerts",
                  desc: `Notify when rainfall onset is imminent in ${DISTRICT_LABELS[user.district] ?? user.district}${user.location?.label ? " · " + user.location.label : ""}`,
                },
                {
                  key: "weeklyReport" as const,
                  label: "Weekly Season Report",
                  desc: "Monday morning forecast summary for your district",
                },
                {
                  key: "systemUpdates" as const,
                  label: "System Updates",
                  desc: "Platform maintenance and feature announcements",
                },
              ]).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between pt-4 first:pt-0">
                  <div className="flex-1 pr-4">
                    <p className="text-[13.5px] font-semibold" style={{ color: "#1a2332" }}>{label}</p>
                    <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "#6b7a8d" }}>{desc}</p>
                  </div>
                  <Toggle enabled={notifications[key]} onToggle={() => handleNotificationToggle(key)} />
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11.5px] leading-relaxed" style={{ color: "#6b7a8d" }}>
              Alerts are localised to your district{user.location?.label ? ` (${user.location.label})` : ""}. Enable browser notifications when prompted for real-time alerts.
            </p>
          </Card>

          {/* Account & Security */}
          <Card title="Account & Security" icon={Shield} iconBg="rgba(214,69,69,0.08)" iconColor="#D64545">
            <div className="space-y-3">
              <div className="rounded-xl p-4" style={{ background: "#f8fafd", border: "1.5px solid #e2e8f0" }}>
                <p className="text-[12.5px] font-semibold mb-0.5" style={{ color: "#1a2332" }}>Email address</p>
                <p className="text-[13px]" style={{ color: "#6b7a8d" }}>{user.email}</p>
              </div>

              <button
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-[13px] font-semibold transition-all duration-200 hover:bg-[#f0f4f8]"
                style={{ border: "1.5px solid #e2e8f0", color: "#1a2332" }}>
                Change Password
                <span className="text-[11px] font-normal" style={{ color: "#6b7a8d" }}>Send reset link →</span>
              </button>

              <button onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[13.5px] font-bold transition-all duration-200 hover:shadow-md active:scale-95 text-white"
                style={{ background: "linear-gradient(135deg,#D64545,#b83232)" }}>
                <LogOut className="h-4 w-4" />
                Sign Out of ESRI Malawi
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
