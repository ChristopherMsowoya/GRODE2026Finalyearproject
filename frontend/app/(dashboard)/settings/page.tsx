"use client"

import { useState, useEffect } from "react"
import {
  Bell,
  Globe,
  Shield,
  Palette,
  Database,
  ChevronRight,
  Check,
  ToggleLeft,
  ToggleRight,
  Sliders,
  X,
  RotateCcw,
  Activity,
} from "lucide-react"
import { useUser } from "@/lib/user-context"

// ─── Toggle component ─────────────────────────────────────────────────────────
function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex-shrink-0">
      {enabled ? (
        <ToggleRight className="h-6 w-7 transition-colors duration-200" style={{ color: "#1F7A63" }} />
      ) : (
        <ToggleLeft className="h-6 w-7 text-[#c0cad6] transition-colors duration-200" />
      )}
    </button>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────
function SettingSection({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  children,
}: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl bg-white p-6"
      style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: iconBg }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color: iconColor }} />
        </div>
        <h2 className="text-[16px] font-bold" style={{ color: "#0F2A3D" }}>
          {title}
        </h2>
      </div>
      <div className="space-y-4 divide-y divide-[#f0f4f8]">{children}</div>
    </div>
  )
}

// ─── Setting row ─────────────────────────────────────────────────────────────
function SettingRow({
  label,
  desc,
  control,
}: {
  label: string
  desc?: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between pt-4 first:pt-0">
      <div className="flex-1 pr-4">
        <p className="text-[13.5px] font-semibold" style={{ color: "#1a2332" }}>
          {label}
        </p>
        {desc && (
          <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "#6b7a8d" }}>
            {desc}
          </p>
        )}
      </div>
      {control}
    </div>
  )
}

// ─── Range Item ──────────────────────────────────────────────────────────────
function RangeItem({ min, max, initialValue, unit }: { min: number, max: number, initialValue: number, unit: string }) {
  const [val, setVal] = useState(initialValue)
  return (
    <div className="flex items-center gap-2 w-[140px] justify-end">
      <input 
        type="range" min={min} max={max} value={val} 
        onChange={(e) => setVal(Number(e.target.value))} 
        className="w-[90px] accent-[#1F7A63] cursor-pointer" 
      />
      <span className="text-[12.5px] font-bold text-[#1a2332] w-[35px] text-right">
        {val}{unit}
      </span>
    </div>
  )
}

// ─── Algorithm Config Modal ──────────────────────────────────────────────────
const DEFAULT_ALGO_PARAMS = {
  rainfallTrigger: "25mm accumulation within 3 days",
  drySpellThreshold: "no dry spell >=10 days within 20 days after onset",
  window2d: true,
  window5d: true,
  window9d: true,
}

function AlgorithmConfigModal({ onClose }: { onClose: () => void }) {
  const [params, setParams] = useState(DEFAULT_ALGO_PARAMS)
  const [saved, setSaved] = useState(false)

  const handleReset = () => {
    setParams(DEFAULT_ALGO_PARAMS)
    setSaved(false)
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(10,25,44,0.65)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-[600px] rounded-2xl bg-white p-7 mx-4"
        style={{ boxShadow: "0 20px 60px rgba(15,42,61,0.25)", maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(31,122,99,0.10)" }}>
              <Sliders className="h-4.5 w-4.5" style={{ color: "#1F7A63" }} />
            </div>
            <div>
              <h2 className="text-[17px] font-bold" style={{ color: "#0F2A3D" }}>Algorithm Configuration</h2>
              <p className="text-[12px]" style={{ color: "#6b7a8d" }}>Expert parameters — resets on logout or session timeout</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[#f0f4f8]"
          >
            <X className="h-4 w-4" style={{ color: "#6b7a8d" }} />
          </button>
        </div>

        <div className="space-y-5 divide-y divide-[#f0f4f8]">

          {/* Onset Algorithm */}
          <div className="pt-0">
            <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3" style={{ color: "#0F2A3D" }}>Onset Algorithm</h3>
            <div>
              <label className="block text-[11.5px] font-semibold mb-1.5" style={{ color: "#6b7a8d" }}>Rainfall Trigger</label>
              <input
                type="text"
                value={params.rainfallTrigger}
                onChange={e => setParams(p => ({...p, rainfallTrigger: e.target.value}))}
                className="w-full rounded-xl px-3.5 py-2.5 text-[13px] font-medium outline-none transition-all"
                style={{ border: "1.5px solid #e2e8f0", color: "#1a2332", background: "#fafbfd" }}
              />
              <p className="text-[11px] mt-1" style={{ color: "#6b7a8d" }}>Default: 25mm accumulation within 3 days</p>
            </div>
          </div>

          {/* Persistence Rule */}
          <div className="pt-5">
            <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3" style={{ color: "#0F2A3D" }}>Persistence Rule</h3>
            <div>
              <label className="block text-[11.5px] font-semibold mb-1.5" style={{ color: "#6b7a8d" }}>Dry Spell Threshold</label>
              <input
                type="text"
                value={params.drySpellThreshold}
                onChange={e => setParams(p => ({...p, drySpellThreshold: e.target.value}))}
                className="w-full rounded-xl px-3.5 py-2.5 text-[13px] font-medium outline-none transition-all"
                style={{ border: "1.5px solid #e2e8f0", color: "#1a2332", background: "#fafbfd" }}
              />
              <p className="text-[11px] mt-1" style={{ color: "#6b7a8d" }}>Default: no dry spell ≥10 days within 20 days after onset</p>
            </div>
          </div>

          {/* Rainfall Fragility Check */}
          <div className="pt-5">
            <h3 className="text-[13px] font-bold uppercase tracking-widest mb-3" style={{ color: "#0F2A3D" }}>Rainfall Fragility Check — Dry Spell Windows</h3>
            <div className="space-y-2">
              {[
                { key: "window2d" as const, label: "2-Day Window", desc: "Monitor 2-day dry spell risk post-onset" },
                { key: "window5d" as const, label: "5-Day Window", desc: "Monitor 5-day dry spell risk post-onset" },
                { key: "window9d" as const, label: "9-Day Window", desc: "Monitor 9-day dry spell risk post-onset" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "#f8fafd", border: "1.5px solid #f0f4f8" }}>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "#1a2332" }}>{label}</p>
                    <p className="text-[11.5px]" style={{ color: "#6b7a8d" }}>{desc}</p>
                  </div>
                  <Toggle enabled={params[key]} onToggle={() => setParams(p => ({...p, [key]: !p[key]}))} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-7 pt-5" style={{ borderTop: "1.5px solid #f0f4f8" }}>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-all hover:bg-[#f0f4f8]"
            style={{ border: "1.5px solid #e2e8f0", color: "#1a2332" }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-bold text-white transition-all hover:opacity-90 hover:shadow-md active:scale-95"
            style={{ background: saved ? "#1F7A63" : "linear-gradient(135deg, #0F2A3D 0%, #1F7A63 100%)" }}
          >
            {saved ? <Check className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {saved ? "Saved!" : "Apply Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useUser()
  const [algoConfigOpen, setAlgoConfigOpen] = useState(false)
  const [fontSize, setFontSize] = useState<"small" | "normal" | "large" | "larger">("normal")

  useEffect(() => {
    const saved = localStorage.getItem("fontSize") as "small" | "normal" | "large" | "larger" | null
    if (saved) setFontSize(saved)
  }, [])

  useEffect(() => {
    localStorage.setItem("fontSize", fontSize)
    const scale: Record<string, number> = { small: 0.9, normal: 1, large: 1.1, larger: 1.2 }
    document.documentElement.style.fontSize = `${16 * scale[fontSize]}px`
  }, [fontSize])

  const [notifications, setNotifications] = useState({
    riskAlerts: true,
    weeklyReport: true,
    systemUpdates: false,
    onsetAlerts: true,
  })

  const [preferences, setPreferences] = useState({
    darkMode: false,
    compactView: false,
    animations: true,
  })

  const [language, setLanguage] = useState("en")
  const [district, setDistrict] = useState("lilongwe")

  const toggle = (
    key: string,
    group: "notifications" | "preferences",
    setFn: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  ) =>
    setFn((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="space-y-6 max-w-full">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[32px] font-extrabold tracking-tight" style={{ color: "#0F2A3D" }}>
          Settings
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "#6b7a8d" }}>
          Manage your account preferences, notifications, and regional data configuration.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5">

        {/* Column 1 */}
        <div className="space-y-5">

          {/* Notifications */}
          <SettingSection icon={Bell} iconBg="rgba(244,162,97,0.12)" iconColor="#F4A261" title="Notifications">
            <SettingRow
              label="Risk Alerts"
              desc="Receive alerts when false-onset or crop stress risk increases"
              control={
                <Toggle
                  enabled={notifications.riskAlerts}
                  onToggle={() => toggle("riskAlerts", "notifications", setNotifications as any)}
                />
              }
            />
            <SettingRow
              label="Weekly Season Report"
              desc="A summary of forecast conditions delivered every Monday"
              control={
                <Toggle
                  enabled={notifications.weeklyReport}
                  onToggle={() => toggle("weeklyReport", "notifications", setNotifications as any)}
                />
              }
            />
            <SettingRow
              label="Onset Date Alerts"
              desc="Get notified when rainfall onset is imminent in your district"
              control={
                <Toggle
                  enabled={notifications.onsetAlerts}
                  onToggle={() => toggle("onsetAlerts", "notifications", setNotifications as any)}
                />
              }
            />
            <SettingRow
              label="System Updates"
              desc="Platform maintenance and feature announcements"
              control={
                <Toggle
                  enabled={notifications.systemUpdates}
                  onToggle={() => toggle("systemUpdates", "notifications", setNotifications as any)}
                />
              }
            />
          </SettingSection>

          {/* Display */}
          <SettingSection icon={Palette} iconBg="rgba(31,122,99,0.10)" iconColor="#1F7A63" title="Display & Accessibility">
            <SettingRow
              label="Font Size"
              desc="Adjust text size across the entire app"
              control={
                <div className="flex items-center gap-2">
                  {(["small", "normal", "large", "larger"] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setFontSize(size)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                      style={{
                        background: fontSize === size ? "#1F7A63" : "#f0f4f8",
                        color: fontSize === size ? "white" : "#6b7a8d",
                      }}
                    >
                      {size === "small" ? "S" : size === "normal" ? "M" : size === "large" ? "L" : "XL"}
                    </button>
                  ))}
                </div>
              }
            />
            <SettingRow
              label="Dark Mode"
              desc="Switch to a dark colour theme"
              control={
                <Toggle
                  enabled={preferences.darkMode}
                  onToggle={() => toggle("darkMode", "preferences", setPreferences as any)}
                />
              }
            />
            <SettingRow
              label="Compact View"
              desc="Reduce spacing between dashboard cards"
              control={
                <Toggle
                  enabled={preferences.compactView}
                  onToggle={() => toggle("compactView", "preferences", setPreferences as any)}
                />
              }
            />
            <SettingRow
              label="Animations"
              desc="Enable smooth chart and UI animations"
              control={
                <Toggle
                  enabled={preferences.animations}
                  onToggle={() => toggle("animations", "preferences", setPreferences as any)}
                />
              }
            />
          </SettingSection>
        </div>

        {/* Column 2 */}
        <div className="space-y-5">

          {/* Region & Language */}
          <SettingSection icon={Globe} iconBg="rgba(15,42,61,0.08)" iconColor="#0F2A3D" title="Region & Language">
            <SettingRow
              label="Language"
              control={
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="rounded-xl px-3 py-2 text-[12.5px] font-medium outline-none transition-all"
                  style={{ border: "1.5px solid #e2e8f0", color: "#1a2332", minWidth: "120px" }}
                >
                  <option value="en">English</option>
                  <option value="ny">Chichewa</option>
                  <option value="fr">French</option>
                </select>
              }
            />
            <SettingRow
              label="Default District"
              control={
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="rounded-xl px-3 py-2 text-[12.5px] font-medium outline-none"
                  style={{ border: "1.5px solid #e2e8f0", color: "#1a2332", minWidth: "140px" }}
                >
                  <option value="lilongwe">Lilongwe</option>
                  <option value="dedza">Dedza</option>
                  <option value="mchinji">Mchinji</option>
                  <option value="salima">Salima</option>
                  <option value="blantyre">Blantyre</option>
                </select>
              }
            />
          </SettingSection>

          {/* Algorithm Adjustment (Expert Only) */}
          {user?.role === "expert" && (
            <SettingSection icon={Sliders} iconBg="rgba(31,122,99,0.10)" iconColor="#1F7A63" title="Algorithm Adjustment (Expert Area)">
              <div className="pt-4">
                <p className="text-[13px] leading-relaxed mb-4" style={{ color: "#6b7a8d" }}>
                  Configure onset detection parameters. Changes apply for the current session only and reset on logout or timeout.
                </p>
                <button
                  onClick={() => setAlgoConfigOpen(true)}
                  className="flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-bold text-white transition-all hover:opacity-90 hover:shadow-md active:scale-95"
                  style={{ background: "linear-gradient(135deg, #0F2A3D 0%, #1F7A63 100%)" }}
                >
                  <Sliders className="h-4 w-4" />
                  Open Algorithm Configuration
                </button>
              </div>
            </SettingSection>
          )}

          {/* Data Sources */}
          <SettingSection icon={Database} iconBg="rgba(31,122,99,0.10)" iconColor="#1F7A63" title="Data Sources">
            {[
              { name: "CHIRPS Historical Data",     status: "Connected", color: "#1F7A63" },
              { name: "ERA5 Reanalysis Dataset",    status: "Connected", color: "#1F7A63" },
              { name: "HEX Climate Grid",           status: "Connected", color: "#1F7A63" },
            ].map(({ name, status, color }) => (
              <SettingRow
                key={name}
                label={name}
                control={
                  <span
                    className="rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide"
                    style={{ color, background: "rgba(31,122,99,0.10)" }}
                  >
                    {status}
                  </span>
                }
              />
            ))}
          </SettingSection>

          {/* System Status */}
          <SettingSection icon={Activity} iconBg="rgba(15,42,61,0.08)" iconColor="#0F2A3D" title="System Status">
            {[
              { label: "Data Used",         value: "CHIRPS · ERA5 · HEX",       ok: true  },
              { label: "DHIS2 Climate API", value: "Connected · v2.38",          ok: true  },
              { label: "Map Tiles",         value: "CartoDB · ESRI World",       ok: true  },
            ].map(({ label, value, ok }) => (
              <SettingRow
                key={label}
                label={label}
                desc={value}
                control={
                  <span
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold"
                    style={{ color: ok ? "#1F7A63" : "#F4A261", background: ok ? "rgba(31,122,99,0.10)" : "rgba(244,162,97,0.12)" }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: ok ? "#1F7A63" : "#F4A261" }} />
                    {ok ? "Operational" : "Degraded"}
                  </span>
                }
              />
            ))}
          </SettingSection>

          {/* Security */}
          <SettingSection icon={Shield} iconBg="rgba(214,69,69,0.08)" iconColor="#D64545" title="Security">
            <SettingRow
              label="Two-Factor Authentication"
              desc="Add an extra layer of security to your account"
              control={<Toggle enabled={false} onToggle={() => {}} />}
            />
            <SettingRow
              label="Session Timeout"
              control={
                <select
                  className="rounded-xl px-3 py-2 text-[12.5px] font-medium outline-none"
                  style={{ border: "1.5px solid #e2e8f0", color: "#1a2332", minWidth: "120px" }}
                >
                  <option>30 minutes</option>
                  <option>1 hour</option>
                  <option>4 hours</option>
                  <option>Never</option>
                </select>
              }
            />
          </SettingSection>
        </div>
      </div>

      {/* ── Save Bar ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-2xl px-8 py-5"
        style={{ background: "#f8fafd", border: "1.5px solid #e2e8f0" }}
      >
        <p className="text-[13px]" style={{ color: "#6b7a8d" }}>
          Changes are saved automatically. Last saved: just now.
        </p>
        <div className="flex items-center gap-3">
          <button
            className="rounded-xl border px-5 py-2.5 text-[13px] font-semibold transition-all hover:bg-[#f0f4f8]"
            style={{ border: "1.5px solid #e2e8f0", color: "#1a2332" }}
          >
            Reset Defaults
          </button>
          <button
            className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-bold text-white transition-all hover:opacity-90 hover:shadow-md active:scale-95"
            style={{ background: "linear-gradient(135deg, #0F2A3D 0%, #1F7A63 100%)" }}
          >
            <Check className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>
      {/* Algorithm Config Modal */}
      {algoConfigOpen && <AlgorithmConfigModal onClose={() => setAlgoConfigOpen(false)} />}
    </div>
  )
}
