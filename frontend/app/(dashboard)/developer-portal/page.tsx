"use client"

import { useState } from "react"
import { BookOpen, Code2, Copy, Download, Zap } from "lucide-react"

const endpoints = [
  {
    method: "GET",
    path: "/api/dashboard/overview",
    description: "Returns total grid cells, analyzed seasons, and available rainfall years for the dashboard.",
  },
  {
    method: "GET",
    path: "/api/districts/summary",
    description: "Returns district-level summary counts used for coverage indicators and live status checks.",
  },
  {
    method: "GET",
    path: "/api/grid-diagnostics?district=Lilongwe&source_grid=esri_5km_v1&limit=2500",
    description: "Returns GeoJSON grid-cell diagnostics with onset, false-onset, and dry-spell probabilities.",
  },
  {
    method: "GET",
    path: "/api/locations/districts",
    description: "Returns available Malawi districts and location counts for the area search workflow.",
  },
  {
    method: "GET",
    path: "/api/locations/area-search?district=Lilongwe&q=Area%2025&limit=5",
    description: "Searches location areas inside a selected district and links each match to the nearest diagnostic grid cell.",
  },
  {
    method: "GET",
    path: "/api/onset/timeline?grid_id=G4992&start_year=2021&end_year=2025",
    description: "Returns P10, median, and P90 onset timing for a selected grid and season range.",
  },
  {
    method: "GET",
    path: "/api/onset/trigger-events?grid_id=G4992&start_year=2022&end_year=2022",
    description: "Returns true rainfall onset trigger events detected from CHIRPS rainfall data for a grid cell.",
  },
]

const responseFields = [
  "grid_id: unique grid cell identifier",
  "district_name: district containing the grid cell",
  "onset_probability: true onset detection probability",
  "false_onset_probability: probability that early rainfall is followed by dry conditions",
  "dry_spell_probability: probability of prolonged dry spell conditions",
  "centroid_lat / centroid_lon: grid-cell centre coordinates",
  "seasons_analyzed: number of rainfall seasons included",
]

export default function DeveloperPortalPage() {
  const [showDocs, setShowDocs] = useState(false)

  return (
    <div className="space-y-8 max-w-full">
      <div className="rounded-2xl bg-white p-8 border border-[#e2e8f0]">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-[#1F7A63] rounded-xl flex items-center justify-center">
              <Zap className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-[#0F2A3D] mb-2">API Access for Developers</h3>
            <p className="text-[#6b7a8d] mb-4">
              Integrate GRODE rainfall diagnostics into dashboards, research tools, farm advisory apps, and presentation prototypes.
            </p>
            <button
              type="button"
              onClick={() => setShowDocs((value) => !value)}
              className="mt-2 inline-flex items-center px-6 py-3 bg-[#0F2A3D] text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              <Download className="h-4 w-4 inline mr-2" />
              {showDocs ? "Hide API Documentation" : "View API Documentation"}
            </button>
          </div>
        </div>
      </div>

      {showDocs && (
      <section className="rounded-2xl bg-white p-8 border border-[#e2e8f0]">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef7f4] text-[#1F7A63]">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#0F2A3D]">GRODE API Documentation</h3>
            <p className="mt-1 text-sm leading-6 text-[#6b7a8d]">Reference endpoints used by the GRODE frontend and rainfall diagnostic workflow.</p>
          </div>
        </div>

        <div className="space-y-3">
          {endpoints.map((endpoint) => (
            <div key={endpoint.path} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="rounded-md bg-[#1F7A63] px-2 py-1 text-[11px] font-black text-white">{endpoint.method}</span>
                  <code className="break-all text-[13px] font-semibold text-[#0F2A3D]">{endpoint.path}</code>
                </div>
                <Copy className="hidden h-4 w-4 flex-shrink-0 text-[#94a3b8] md:block" />
              </div>
              <p className="mt-2 text-[13px] leading-6 text-[#6b7a8d]">{endpoint.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[#dceee8] bg-[#f3faf7] p-5">
            <h4 className="flex items-center gap-2 text-[15px] font-bold text-[#0F2A3D]">
              <Code2 className="h-4 w-4 text-[#1F7A63]" />
              Common Response Fields
            </h4>
            <ul className="mt-3 space-y-2 text-[13px] text-[#315f52]">
              {responseFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
            <h4 className="text-[15px] font-bold text-[#0F2A3D]">Example Request</h4>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-[#0F2A3D] p-4 text-[12px] leading-6 text-white">
{`fetch("/api/grid-diagnostics?district=Lilongwe&limit=2500")
  .then((res) => res.json())
  .then((geojson) => console.log(geojson.features))`}
            </pre>
          </div>
        </div>
      </section>
      )}

      <div className="rounded-2xl bg-white p-8 border border-[#e2e8f0]">
        <h3 className="text-xl font-bold text-[#0F2A3D] mb-6">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-[#0F2A3D]">Do API outputs represent district averages?</h4>
            <p className="text-sm text-[#6b7a8d] mt-1">Grid diagnostic endpoints return per-grid outputs. Districts are used for filtering and map context.</p>
          </div>
          <div>
            <h4 className="font-semibold text-[#0F2A3D]">Which season does GRODE focus on?</h4>
            <p className="text-sm text-[#6b7a8d] mt-1">The rainfall algorithms focus on Malawi's rainy season, from November to April.</p>
          </div>
          <div>
            <h4 className="font-semibold text-[#0F2A3D]">Can API data be used in another app?</h4>
            <p className="text-sm text-[#6b7a8d] mt-1">Yes. The local API returns JSON and GeoJSON responses that can be consumed by dashboards, maps, and research scripts.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
