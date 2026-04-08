"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  User, Mail, Lock, Eye, EyeOff, MapPin, Phone,
  ChevronRight, ChevronLeft, Check, ArrowRight,
  Navigation, Loader2, X, Sprout,
} from "lucide-react"
import { useUser } from "@/lib/user-context"
import type { UserProfile } from "@/lib/user-context"

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

// ─── Shared field components ──────────────────────────────────────────────────
function InputField({
  id, label, type = "text", placeholder, value, onChange, required, suffix,
}: {
  id: string; label: string; type?: string; placeholder: string
  value: string; onChange: (v: string) => void
  required?: boolean; suffix?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold" style={{ color: "#1a2332" }}>
        {label}{required && <span className="ml-1" style={{ color: "#D64545" }}>*</span>}
      </label>
      <div className="relative">
        <input
          id={id} type={type} placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full rounded-xl py-3 px-4 text-[13.5px] outline-none transition-all duration-200 bg-white"
          style={{ border: `1.5px solid ${focused ? "#1F7A63" : "#e2e8f0"}`, color: "#1a2332" }}
        />
        {suffix && <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
    </div>
  )
}

function SelectField({
  id, label, value, onChange, options, required,
}: {
  id: string; label: string; value: string
  onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold" style={{ color: "#1a2332" }}>
        {label}{required && <span className="ml-1" style={{ color: "#D64545" }}>*</span>}
      </label>
      <div className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl py-3 pl-4 pr-8 text-[13.5px] outline-none transition-all duration-200 bg-white"
          style={{ border: "1.5px solid #e2e8f0", color: "#1a2332" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#1F7A63")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
          style={{ color: "#6b7a8d" }} viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 8L2 4h8L6 8z" />
        </svg>
      </div>
    </div>
  )
}

// ─── Role card ────────────────────────────────────────────────────────────────
function RoleCard({ value, label, description, selected, onSelect }: {
  value: string; label: string; description: string;
  selected: boolean; onSelect: () => void
}) {
  return (
    <button type="button" onClick={onSelect}
      className="relative flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition-all duration-200 w-full"
      style={selected
        ? { border: "2px solid #1F7A63", background: "rgba(31,122,99,0.06)", boxShadow: "0 0 0 4px rgba(31,122,99,0.08)" }
        : { border: "1.5px solid #e2e8f0", background: "#fff" }}
    >
      <div>
        <p className="text-[13.5px] font-bold" style={{ color: "#1a2332" }}>{label}</p>
        <p className="text-[12px] leading-snug" style={{ color: "#6b7a8d" }}>{description}</p>
      </div>
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "#1F7A63" }}>
          <Check className="h-3 w-3 text-white" />
        </span>
      )}
    </button>
  )
}

// ─── Crop chips ───────────────────────────────────────────────────────────────
function CropChips({ selected, toggle }: { selected: string[]; toggle: (c: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold" style={{ color: "#1a2332" }}>Primary Crops</span>
      <div className="flex flex-wrap gap-2">
        {CROPS.map((crop) => {
          const active = selected.includes(crop)
          return (
            <button key={crop} type="button" onClick={() => toggle(crop)}
              className="rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-all duration-200 flex items-center gap-1"
              style={active
                ? { background: "linear-gradient(135deg,#0F2A3D,#1F7A63)", color: "#fff", border: "1.5px solid transparent" }
                : { background: "#f0f4f8", color: "#6b7a8d", border: "1.5px solid #e2e8f0" }}
            >
              {active && <Check className="h-3 w-3" />}{crop}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [{ n: 1, label: "Account" }, { n: 2, label: "Profile" }, { n: 3, label: "Done" }]
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const done = step > s.n; const active = step === s.n
        return (
          <div key={s.n} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold transition-all duration-300"
                style={done ? { background: "#1F7A63", color: "#fff" } : active ? { background: "#0F2A3D", color: "#fff" } : { background: "#f0f4f8", color: "#6b7a8d" }}>
                {done ? <Check className="h-4 w-4" /> : s.n}
              </div>
              <span className="text-[10.5px] font-semibold uppercase tracking-wide"
                style={{ color: done || active ? "#0F2A3D" : "#6b7a8d" }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="mb-4 h-[2px] w-12 transition-all duration-300"
                style={{ background: step > s.n ? "#1F7A63" : "#e2e8f0" }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CreateAccountPage() {
  const router = useRouter()
  const { login } = useUser()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [locating, setLocating] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // Step 1
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")

  // Step 2
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState<"farmer" | "expert" | "">("")
  const [district, setDistrict] = useState("")
  const [locationLabel, setLocationLabel] = useState("")
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [crops, setCrops] = useState<string[]>([])

  const pwMatch = password === confirm && password.length > 0
  const toggleCrop = (c: string) =>
    setCrops((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c])

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

  const districtLabel = () =>
    DISTRICTS.find((d) => d.value === district)?.label ?? district

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName || !role || !district) return

    const profile: UserProfile = {
      email,
      firstName: fullName.split(' ')[0] || 'User',
      lastName: fullName.split(' ').slice(1).join(' ') || '',
      phone,
      role: role as "farmer" | "expert",
      district,
      crops,
      location: locationCoords
        ? { lat: locationCoords.lat, lng: locationCoords.lng, label: locationLabel }
        : locationLabel ? { lat: null, lng: null, label: locationLabel } : null,
      notifications: {
        riskAlerts: true,
        weeklyReport: true,
        onsetAlerts: true,
        systemUpdates: false,
      },
      createdAt: new Date().toISOString(),
    }
    login(profile)
    setEmailSent(true)
    setStep(3)
  }

  const goToDashboard = () => router.push("/")

  return (
    <div className="min-h-screen grid lg:grid-cols-[400px_1fr]" style={{ background: "linear-gradient(135deg,#0F2A3D 0%,#0d3b2e 50%,#1F7A63 100%)" }}>

      {/* ── Left branding panel ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:flex-col justify-between p-12 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-white leading-tight">Climate Intel</p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>ESRI Malawi District Portal</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-[34px] font-extrabold text-white leading-tight tracking-tight">
              Protecting Malawi&apos;s harvests with climate intelligence.
            </h1>
            <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
              Join thousands of farmers and agronomists using real-time satellite data and expert forecasts to make better planting decisions.
            </p>
          </div>
          {[
            { title: "Rainfall Onset Detection", desc: "Know exactly when the season begins in your district." },
            { title: "Satellite Soil Moisture", desc: "Real-time data to guide irrigation decisions." },
            { title: "Crop Risk Assessment", desc: "False-onset risk scores tailored to your crop type." },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-4">
              <div>
                <p className="text-[13.5px] font-bold text-white">{f.title}</p>
                <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>© 2026 ESRI Malawi Climate Intelligence System</p>
      </div>

      {/* ── Form panel ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 items-start justify-center p-6 lg:p-10 overflow-y-auto">
        <div className="w-full max-w-[520px] rounded-3xl bg-white p-8 lg:p-10 my-6"
          style={{ boxShadow: "0 32px 80px -16px rgba(0,0,0,0.35)" }}>

          <div className="flex justify-center mb-8">
            <StepIndicator step={step} />
          </div>

          {/* ── STEP 1: Account credentials ─────────────────────────────── */}
          {step === 1 && (
            <div>
              <div className="mb-7">
                <h2 className="text-[26px] font-extrabold tracking-tight" style={{ color: "#0F2A3D" }}>Create your account</h2>
                <p className="mt-1 text-[13.5px]" style={{ color: "#6b7a8d" }}>Start with your login credentials.</p>
              </div>

              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setStep(2) }}>
                <InputField id="email" label="Email address" type="email"
                  placeholder="you@example.com"
                  value={email} onChange={setEmail} required />

                <InputField id="password" label="Password"
                  type={showPw ? "text" : "password"} placeholder="Min. 8 characters"
                  value={password} onChange={setPassword} required
                  suffix={
                    <button type="button" onClick={() => setShowPw((p) => !p)}
                      className="text-[#6b7a8d] hover:text-[#0F2A3D] transition-colors">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />

                <InputField id="confirm" label="Confirm password"
                  type={showConfirm ? "text" : "password"} placeholder="Repeat your password"
                  value={confirm} onChange={setConfirm} required
                  suffix={
                    <button type="button" onClick={() => setShowConfirm((p) => !p)}
                      className="text-[#6b7a8d] hover:text-[#0F2A3D] transition-colors">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />

                {confirm.length > 0 && (
                  <p className="text-[12px] font-semibold flex items-center gap-1"
                    style={{ color: pwMatch ? "#1F7A63" : "#D64545" }}>
                    {pwMatch ? <><Check className="h-3.5 w-3.5" />Passwords match</> : <>✕ Passwords do not match</>}
                  </p>
                )}

                {password.length > 0 && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[11px] text-[#6b7a8d]">Strength</span>
                      <span className="text-[11px] font-bold"
                        style={{ color: password.length < 6 ? "#D64545" : password.length < 10 ? "#F4A261" : "#1F7A63" }}>
                        {password.length < 6 ? "Weak" : password.length < 10 ? "Fair" : "Strong"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#f0f4f8] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: password.length < 6 ? "25%" : password.length < 10 ? "60%" : "100%",
                          background: password.length < 6 ? "#D64545" : password.length < 10 ? "#F4A261" : "#1F7A63",
                        }} />
                    </div>
                  </div>
                )}

                <button type="submit" disabled={!email || !password || !pwMatch}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#0F2A3D 0%,#1F7A63 100%)" }}>
                  Continue to Profile <ChevronRight className="h-4 w-4" />
                </button>
              </form>

              <p className="mt-6 text-center text-[13px]" style={{ color: "#6b7a8d" }}>
                Already have an account?{" "}
                <Link href="/" className="font-semibold hover:underline" style={{ color: "#1F7A63" }}>Sign in</Link>
              </p>
            </div>
          )}

          {/* ── STEP 2: Profile details ──────────────────────────────────── */}
          {step === 2 && (
            <div>
              <div className="mb-7">
                <h2 className="text-[26px] font-extrabold tracking-tight" style={{ color: "#0F2A3D" }}>Set up your profile</h2>
                <p className="mt-1 text-[13.5px]" style={{ color: "#6b7a8d" }}>Help us personalise your ESRI experience.</p>
              </div>

              <form className="space-y-5" onSubmit={handleCreateProfile}>
                {/* Full Name */}
                <InputField id="fullName" label="Full name" placeholder="e.g. Chimwemwe Banda"
                  value={fullName} onChange={setFullName} required />

                <InputField id="phone" label="Phone number" type="tel"
                  placeholder="+265 999 000 000" value={phone} onChange={setPhone} />

                {/* Role */}
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold" style={{ color: "#1a2332" }}>
                    I am a <span style={{ color: "#D64545" }}>*</span>
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <RoleCard value="farmer" label="Farmer"
                      description="I grow crops and need planting guidance."
                      selected={role === "farmer"} onSelect={() => setRole("farmer")} />
                    <RoleCard value="expert" label="Agronomist / Expert"
                      description="I advise farmers on cropping decisions."
                      selected={role === "expert"} onSelect={() => setRole("expert")} />
                  </div>
                </div>

                {/* District */}
                <SelectField id="district" label="Home district"
                  value={district} onChange={setDistrict} required
                  options={[{ value: "", label: "Select your district…" }, ...DISTRICTS]} />

                {/* Location */}
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold" style={{ color: "#1a2332" }}>
                    Specific Location <span className="text-[11px] font-normal text-[#6b7a8d]">(village, town, or GPS)</span>
                  </span>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="e.g. Area 49, Lilongwe"
                        value={locationLabel}
                        onChange={(e) => setLocationLabel(e.target.value)}
                        className="w-full rounded-xl py-3 px-4 text-[13.5px] outline-none transition-all duration-200 bg-white"
                        style={{ border: "1.5px solid #e2e8f0", color: "#1a2332" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#1F7A63")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
                      />
                      {locationLabel && (
                        <button type="button" onClick={() => { setLocationLabel(""); setLocationCoords(null) }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7a8d] hover:text-[#D64545]">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <button type="button" onClick={detectLocation}
                      disabled={locating}
                      title="Detect my GPS location"
                      className="flex items-center gap-1.5 rounded-xl px-4 py-3 text-[12.5px] font-semibold transition-all duration-200 hover:shadow-sm active:scale-95 flex-shrink-0"
                      style={{ background: "rgba(31,122,99,0.1)", color: "#1F7A63", border: "1.5px solid rgba(31,122,99,0.25)" }}>
                      {locating
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Navigation className="h-4 w-4" />}
                      {locating ? "Locating…" : "GPS"}
                    </button>
                  </div>
                  {locationCoords && (
                    <p className="text-[11.5px] flex items-center gap-1.5" style={{ color: "#1F7A63" }}>
                      <Check className="h-3.5 w-3.5" />
                      GPS captured: {locationCoords.lat.toFixed(5)}, {locationCoords.lng.toFixed(5)}
                    </p>
                  )}
                  <p className="text-[11px]" style={{ color: "#6b7a8d" }}>
                    Used to localise rainfall alerts and onset notifications to your exact area.
                  </p>
                </div>

                {/* Crops */}
                <CropChips selected={crops} toggle={toggleCrop} />

                {/* Buttons */}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex items-center gap-2 rounded-xl border px-5 py-3 text-[13.5px] font-semibold transition-all duration-200 hover:bg-[#f0f4f8]"
                    style={{ border: "1.5px solid #e2e8f0", color: "#1a2332" }}>
                    <ChevronLeft className="h-4 w-4" />Back
                  </button>
                  <button type="submit" disabled={!fullName || !role || !district}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg,#0F2A3D 0%,#1F7A63 100%)" }}>
                    Create Profile <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── STEP 3: Success / Welcome ────────────────────────────────── */}
          {step === 3 && (
            <div className="flex flex-col items-center text-center py-2">
              {/* Animated ring */}
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full mb-6"
                style={{ background: "rgba(31,122,99,0.1)", border: "3px solid #1F7A63" }}>
                <Check className="h-12 w-12" style={{ color: "#1F7A63" }} />
                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: "#F4A261" }}>✓</span>
              </div>

              <p className="text-[12px] uppercase tracking-widest font-bold mb-2" style={{ color: "#1F7A63" }}>Account created</p>
              <h2 className="text-[28px] font-extrabold tracking-tight leading-tight" style={{ color: "#0F2A3D" }}>
                Welcome, {fullName.split(' ')[0]}!
              </h2>
              <p className="mt-1 text-[15px] font-semibold" style={{ color: "#1F7A63" }}>
                to ESRI Malawi Climate Intelligence
              </p>
              <p className="mt-3 text-[13.5px] leading-relaxed max-w-sm" style={{ color: "#6b7a8d" }}>
                Your profile is set up for{" "}
                <span className="font-semibold" style={{ color: "#0F2A3D" }}>{districtLabel()} District</span>.
                Real-time alerts and forecasts are now personalised for your area.
              </p>

              {/* Email confirmation notice */}
              {emailSent && (
                <div className="mt-5 w-full rounded-2xl px-5 py-4 text-left flex items-start gap-3"
                  style={{ background: "rgba(31,122,99,0.07)", border: "1.5px solid rgba(31,122,99,0.2)" }}>
                  <div>
                    <p className="text-[13px] font-bold" style={{ color: "#0F2A3D" }}>Confirmation email sent</p>
                    <p className="text-[12px] mt-0.5" style={{ color: "#6b7a8d" }}>
                      A verification link has been sent to{" "}
                      <span className="font-semibold" style={{ color: "#1F7A63" }}>{email}</span>.
                      Check your inbox to activate notifications.
                    </p>
                  </div>
                </div>
              )}

              {/* Summary chips */}
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                <span className="rounded-full px-3.5 py-1.5 text-[12px] font-bold"
                  style={{ background: "rgba(15,42,61,0.08)", color: "#0F2A3D" }}>
                  {role === "farmer" ? "Farmer" : "Agronomist"}
                </span>
                <span className="rounded-full px-3.5 py-1.5 text-[12px] font-bold"
                  style={{ background: "rgba(31,122,99,0.1)", color: "#1F7A63" }}>
                  {districtLabel()}
                </span>
                {crops.slice(0, 2).map((c) => (
                  <span key={c} className="rounded-full px-3.5 py-1.5 text-[12px] font-bold"
                    style={{ background: "rgba(244,162,97,0.12)", color: "#c07830" }}>{c}</span>
                ))}
                {crops.length > 2 && (
                  <span className="rounded-full px-3.5 py-1.5 text-[12px] font-bold"
                    style={{ background: "#f0f4f8", color: "#6b7a8d" }}>+{crops.length - 2} crops</span>
                )}
              </div>

              <button onClick={goToDashboard}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95"
                style={{ background: "linear-gradient(135deg,#0F2A3D 0%,#1F7A63 100%)" }}>
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </button>

              <p className="mt-4 text-[12px]" style={{ color: "#6b7a8d" }}>
                Edit your details anytime from{" "}
                <Link href="/profile" className="font-semibold" style={{ color: "#1F7A63" }}>My Profile</Link>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
