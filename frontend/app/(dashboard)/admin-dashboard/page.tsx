"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { Loader2, Lock, LogOut, RotateCcw, Save, ShieldCheck, SlidersHorizontal, Upload } from "lucide-react"
import {
  createAdminSession,
  fetchAlgorithmConfig,
  updateAlgorithmConfig,
  uploadSeasonDataset,
  verifyAdminSession,
  type AlgorithmConfig,
} from "@/lib/algorithm-api"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const ADMIN_TOKEN_KEY = "grode_admin_token"

export default function AdminDashboardPage() {
  const [config, setConfig] = useState<AlgorithmConfig | null>(null)
  const [defaults, setDefaults] = useState<AlgorithmConfig | null>(null)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [accessCode, setAccessCode] = useState("")
  const [loading, setLoading] = useState(true)
  const [authenticating, setAuthenticating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")
  const [authError, setAuthError] = useState("")
  const [newSeasonYear, setNewSeasonYear] = useState("")
  const [datasetFile, setDatasetFile] = useState<File | null>(null)

  useEffect(() => {
    let cancelled = false
    async function restoreSession() {
      setLoading(true)
      const storedToken = typeof window !== "undefined" ? localStorage.getItem(ADMIN_TOKEN_KEY) : null
      if (!storedToken) {
        if (!cancelled) setLoading(false)
        return
      }

      try {
        await verifyAdminSession(storedToken)
        if (!cancelled) {
          setAdminToken(storedToken)
          await loadConfig(storedToken)
        }
      } catch {
        if (typeof window !== "undefined") localStorage.removeItem(ADMIN_TOKEN_KEY)
        if (!cancelled) setAdminToken(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void restoreSession()
    return () => { cancelled = true }
  }, [])

  const loadConfig = async (token: string) => {
    const response = await fetchAlgorithmConfig(token)
    setConfig(response.config)
    setDefaults(response.defaults)
    setAvailableYears(response.available_years)
  }

  const allYearsEnabled = useMemo(() => {
    return !config?.enabled_season_years?.length
  }, [config?.enabled_season_years])

  const updateField = <K extends keyof AlgorithmConfig>(key: K, value: AlgorithmConfig[K]) => {
    setConfig((current) => current ? { ...current, [key]: value } : current)
    setMessage("")
  }

  const toggleSeason = (year: number) => {
    if (!config) return
    const active = new Set(config.enabled_season_years.length ? config.enabled_season_years : availableYears)
    if (active.has(year)) active.delete(year)
    else active.add(year)
    updateField("enabled_season_years", Array.from(active).sort())
  }

  const saveConfig = async () => {
    if (!config || !adminToken) return
    setSaving(true)
    try {
      const response = await updateAlgorithmConfig(config, adminToken)
      setConfig(response.config)
      setMessage(response.message || "Configuration saved.")
    } finally {
      setSaving(false)
    }
  }

  const handleAdminSignIn = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!accessCode.trim()) return
    setAuthenticating(true)
    setAuthError("")
    try {
      const response = await createAdminSession(accessCode.trim())
      localStorage.setItem(ADMIN_TOKEN_KEY, response.token)
      window.dispatchEvent(new Event("grode-admin-session"))
      setAdminToken(response.token)
      setAccessCode("")
      await loadConfig(response.token)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Admin access failed.")
    } finally {
      setAuthenticating(false)
      setLoading(false)
    }
  }

  const signOutAdmin = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    window.dispatchEvent(new Event("grode-admin-session"))
    setAdminToken(null)
    setConfig(null)
    setDefaults(null)
    setMessage("")
  }

  const uploadDataset = async () => {
    if (!datasetFile || !adminToken) return
    const year = newSeasonYear.length === 4 ? Number(newSeasonYear) : null
    if (year !== null && !Number.isFinite(year)) return

    setUploading(true)
    setMessage("")
    try {
      const response = await uploadSeasonDataset(datasetFile, year, adminToken)
      setConfig(response.config)
      if (response.season_year) {
        setAvailableYears((years) => Array.from(new Set([...years, response.season_year as number])).sort())
      }
      setDatasetFile(null)
      setNewSeasonYear("")
      setMessage(response.message)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload rainfall dataset.")
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F2A3D]" />
      </div>
    )
  }

  if (!adminToken || !config) {
    return (
      <div className="mx-auto flex min-h-[520px] max-w-xl items-center justify-center">
        <div className="w-full rounded-xl border border-[#e2e8f0] bg-white p-7 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#eef7f4] text-[#1F7A63]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#0F2A3D]">Admin Access</h1>
              <p className="mt-1 text-[13px] text-[#6b7a8d]">Enter the project admin access code to manage algorithm settings.</p>
            </div>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleAdminSignIn}>
            <label className="block">
              <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#6b7a8d]">Access code</span>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7a8d]" />
                <input
                  type="password"
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value)}
                  placeholder="Enter admin code"
                  className="w-full rounded-lg border border-[#d6dee8] bg-white py-3 pl-10 pr-3 text-[14px] font-semibold text-[#0F2A3D] outline-none focus:border-[#1F7A63]"
                />
              </div>
            </label>
            {authError && (
              <p className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] font-semibold text-[#b91c1c]">
                {authError}
              </p>
            )}
            <button
              type="submit"
              disabled={!accessCode.trim() || authenticating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F2A3D] px-4 py-3 text-[13px] font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {authenticating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {authenticating ? "Checking..." : "Unlock Admin Dashboard"}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#eef7f4] text-[#1F7A63]">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[#0F2A3D]">Admin Dashboard</h1>
                <p className="mt-1 max-w-3xl text-[14px] leading-6 text-[#6b7a8d]">
                  Configure rainfall seasons and algorithm thresholds without editing source code. Rerun the pipeline after saving for maps and graphs to use the new settings.
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={signOutAdmin}
              className="inline-flex items-center gap-2 rounded-lg border border-[#d6dee8] bg-white px-4 py-2 text-[13px] font-bold text-[#0F2A3D] hover:bg-[#f8fafc]"
            >
              <LogOut className="h-4 w-4" />
              Lock
            </button>
            {defaults && (
              <button
                type="button"
                onClick={() => setConfig(defaults)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#d6dee8] bg-white px-4 py-2 text-[13px] font-bold text-[#0F2A3D] hover:bg-[#f8fafc]"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={saveConfig}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F2A3D] px-4 py-2 text-[13px] font-bold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
        </div>
        {message && (
          <p className="mt-4 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-[12px] font-semibold text-[#166534]">
            {message}
          </p>
        )}
      </div>

      <section className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h2 className="text-[17px] font-bold text-[#0F2A3D]">Season Control</h2>
        <p className="mt-1 text-[13px] text-[#6b7a8d]">
          Leave all seasons active to use every season available in the CHIRPS outputs, select only some seasons, or add a season year that has rainfall data ready for the next pipeline run.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateField("enabled_season_years", [])}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${allYearsEnabled ? "border-[#1F7A63] bg-[#eef7f4] text-[#1F7A63]" : "border-[#d6dee8] text-[#0F2A3D]"}`}
          >
            All seasons
          </button>
          {availableYears.map((year) => {
            const selected = allYearsEnabled || config.enabled_season_years.includes(year)
            return (
              <button
                key={year}
                type="button"
                onClick={() => toggleSeason(year)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${selected ? "border-[#1F7A63] bg-[#eef7f4] text-[#1F7A63]" : "border-[#d6dee8] text-[#0F2A3D]"}`}
              >
                {year}-{String(year + 1).slice(-2)}
              </button>
            )
          })}
        </div>
        <div className="mt-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#6b7a8d]">Load rainfall dataset</label>
            <input
              type="file"
              accept=".nc,.nc4,.cdf"
              onChange={(event) => setDatasetFile(event.target.files?.[0] || null)}
              className="w-full rounded-md border border-[#d6dee8] bg-white px-3 py-2 text-[13px] font-semibold text-[#0F2A3D] file:mr-3 file:rounded-md file:border-0 file:bg-[#eef7f4] file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-[#1F7A63] lg:max-w-sm"
            />
            <input
              value={newSeasonYear}
              onChange={(event) => setNewSeasonYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Season year"
              className="w-full rounded-md border border-[#d6dee8] bg-white px-3 py-2 text-[13px] font-semibold text-[#0F2A3D] outline-none focus:border-[#1F7A63] sm:w-36"
            />
            <button
              type="button"
              onClick={uploadDataset}
              disabled={!datasetFile || uploading}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0F2A3D] px-4 py-2 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Loading..." : "Load Dataset"}
            </button>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-[#6b7a8d]">
            Choose the downloaded CHIRPS NetCDF file. GRODE will save it to backend/algorithms/data/raw and register the season; the year can also be inferred from filenames like chirps-v2.0.2026.days_p05.nc.
          </p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <NumberSelect label="Rainy Season Starts" value={config.season_start_month} onChange={(value) => updateField("season_start_month", value)} />
          <NumberSelect label="Rainy Season Ends" value={config.season_end_month} onChange={(value) => updateField("season_end_month", value)} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ConfigCard title="Onset Detection">
          <NumberInput label="Trigger rainfall total (mm)" value={config.onset_trigger_mm} onChange={(value) => updateField("onset_trigger_mm", value)} />
          <NumberInput label="Trigger window (days)" value={config.onset_trigger_window_days} onChange={(value) => updateField("onset_trigger_window_days", value)} />
        </ConfigCard>
        <ConfigCard title="Persistence / False Onset">
          <NumberInput label="Persistence check window (days)" value={config.persistence_window_days} onChange={(value) => updateField("persistence_window_days", value)} />
          <NumberInput label="Failure dry spell length (days)" value={config.persistence_dry_spell_days} onChange={(value) => updateField("persistence_dry_spell_days", value)} />
        </ConfigCard>
        <ConfigCard title="Dry Spell Stress">
          <NumberInput label="Dry day threshold (mm)" value={config.dry_day_threshold_mm} onChange={(value) => updateField("dry_day_threshold_mm", value)} />
          <TextInput
            label="Stress thresholds (days)"
            value={config.dry_spell_threshold_days.join(", ")}
            onChange={(value) => updateField("dry_spell_threshold_days", parseThresholds(value))}
          />
        </ConfigCard>
      </section>
    </div>
  )
}

function ConfigCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <h2 className="text-[16px] font-bold text-[#0F2A3D]">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  )
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#6b7a8d]">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-lg border border-[#d6dee8] px-3 py-2 text-[14px] font-semibold text-[#0F2A3D] outline-none focus:border-[#1F7A63]"
      />
    </label>
  )
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#6b7a8d]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="5, 7, 9"
        className="mt-1 w-full rounded-lg border border-[#d6dee8] px-3 py-2 text-[14px] font-semibold text-[#0F2A3D] outline-none focus:border-[#1F7A63]"
      />
    </label>
  )
}

function NumberSelect({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#6b7a8d]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-lg border border-[#d6dee8] px-3 py-2 text-[14px] font-semibold text-[#0F2A3D] outline-none focus:border-[#1F7A63]"
      >
        {MONTHS.map((month, index) => (
          <option key={month} value={index + 1}>{month}</option>
        ))}
      </select>
    </label>
  )
}

function parseThresholds(value: string) {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
}
