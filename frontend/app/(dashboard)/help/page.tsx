"use client"

import { useState } from "react"
import {
  BookOpen,
  MessageSquare,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  ExternalLink,
  Leaf,
  Map,
  BarChart2,
  AlertTriangle,
  Sprout,
} from "lucide-react"

// ─── FAQ Accordion ────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What does the 'Onset Date' mean for my farm?",
    a: "The onset date is the first day of consistent rainfall (≥20mm over 3 consecutive days) that reliably marks the start of the growing season. It is determined by historical data and current forecast models for your district.",
  },
  {
    q: "How is False-Onset Risk calculated?",
    a: "False-Onset Risk combines short-term rainfall probability with historical dry-spell frequency. A 'High' risk means there is a >70% chance that initial rains will be followed by a dry spell lasting 14 days or more — enough to kill young seedlings.",
  },
  {
    q: "What satellite data sources does Climate Intel use?",
    a: "We fuse three primary datasets: TAMSAT v3.1 (microwave-based rainfall estimation), CHIRPS historical baselines, and DCCMS Malawi national forecast output. Soil moisture is sourced from NASA SMAP Level-3 composites.",
  },
  {
    q: "How often is the dashboard data refreshed?",
    a: "Rainfall and risk indicators are updated every 3 hours from TAMSAT and DCCMS feeds. Soil moisture maps are updated daily. Historical baselines are static per-season.",
  },
  {
    q: "Can I change my default district?",
    a: "Yes. Navigate to Settings → Region & Language → Default District, and select any of the five supported districts. The dashboard will reload with data for your chosen region.",
  },
  {
    q: "What is the difference between 'Farmer' and 'Expert' mode?",
    a: "'Farmer' mode simplifies risk levels into plain-language guidance. 'Expert' mode surfaces raw meteorological variables, confidence intervals, and downloadable model outputs for agronomists and researchers.",
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-xl overflow-hidden border transition-all duration-200"
      style={{ borderColor: open ? "rgba(31,122,99,0.35)" : "#e2e8f0" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#fafbfd]"
      >
        <span className="text-[13.5px] font-semibold pr-8" style={{ color: "#1a2332" }}>
          {q}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: "#1F7A63" }} />
        ) : (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-[#6b7a8d]" />
        )}
      </button>
      {open && (
        <div className="border-t border-[#f0f4f8] px-5 pb-5 pt-4">
          <p className="text-[13px] leading-relaxed" style={{ color: "#6b7a8d" }}>
            {a}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Guide cards ──────────────────────────────────────────────────────────────
const GUIDES = [
  {
    icon: Leaf,
    color: "#1F7A63",
    bg: "#E9F5EC",
    title: "Dashboard Overview",
    desc: "Learn how to read the risk cards and interpret the alert banner.",
    tag: "Beginner",
  },
  {
    icon: Map,
    color: "#0F2A3D",
    bg: "#e8edf2",
    title: "Using the Map",
    desc: "Navigate district layers, toggle basemaps, and download GeoJSON exports.",
    tag: "Intermediate",
  },
  {
    icon: BarChart2,
    color: "#1F7A63",
    bg: "#E9F5EC",
    title: "Reading Onset Timelines",
    desc: "Understand P10, median, and P90 probability windows for planting decisions.",
    tag: "Beginner",
  },
  {
    icon: AlertTriangle,
    color: "#F4A261",
    bg: "#FFF4E5",
    title: "False-Onset Risk Guide",
    desc: "How to act on high-risk warnings and protect your investment.",
    tag: "Intermediate",
  },
  {
    icon: Sprout,
    color: "#D64545",
    bg: "rgba(214,69,69,0.08)",
    title: "Crop Stress Mitigation",
    desc: "Protocols for heat stress, pest pressure, and flood risk management.",
    tag: "Advanced",
  },
  {
    icon: PlayCircle,
    color: "#0F2A3D",
    bg: "#e8edf2",
    title: "Video Walkthroughs",
    desc: "Step-by-step video guides for farmers and field extension officers.",
    tag: "All Levels",
  },
]

const TAG_STYLES: Record<string, { color: string; bg: string }> = {
  Beginner:     { color: "#1F7A63", bg: "rgba(31,122,99,0.10)"  },
  Intermediate: { color: "#F4A261", bg: "rgba(244,162,97,0.12)" },
  Advanced:     { color: "#D64545", bg: "rgba(214,69,69,0.10)"  },
  "All Levels": { color: "#0F2A3D", bg: "rgba(15,42,61,0.08)"   },
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HelpPage() {
  return (
    <div className="space-y-7 max-w-full">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[32px] font-extrabold tracking-tight" style={{ color: "#0F2A3D" }}>
          Help & Documentation
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "#6b7a8d" }}>
          Guides, FAQs, and support resources for the Climate Intel platform.
        </p>
      </div>

      {/* ── Quick-Action Buttons ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: BookOpen,   label: "Documentation",  sub: "Read full platform docs",    color: "#0F2A3D", bg: "#e8edf2"            },
          { icon: PlayCircle, label: "Video Tutorials", sub: "Watch step-by-step guides",  color: "#F4A261", bg: "rgba(244,162,97,0.12)" },
        ].map(({ icon: Icon, label, sub, color, bg }) => (
          <button
            key={label}
            className="card-hover flex flex-col items-start gap-3 rounded-2xl bg-white p-5 text-left transition-all"
            style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.07), 0 0 0 1px #e2e8f0" }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: bg }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <p className="text-[13.5px] font-bold" style={{ color: "#1a2332" }}>{label}</p>
              <p className="text-[12px] mt-0.5" style={{ color: "#6b7a8d" }}>{sub}</p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 mt-auto" style={{ color: "#6b7a8d" }} />
          </button>
        ))}
      </div>

      {/* ── Two-column: Guides + Contact ─────────────────────────────────── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 300px" }}>

        {/* Guides */}
        <div
          className="rounded-2xl bg-white p-6"
          style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}
        >
          <h2 className="text-[17px] font-bold mb-5" style={{ color: "#0F2A3D" }}>Topic Guides</h2>
          <div className="grid grid-cols-2 gap-4">
            {GUIDES.map(({ icon: Icon, color, bg, title, desc, tag }) => {
              const ts = TAG_STYLES[tag]
              return (
                <div
                  key={title}
                  className="card-hover flex flex-col gap-3 rounded-xl p-4 cursor-pointer transition-all"
                  style={{ border: "1.5px solid #f0f4f8" }}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: bg }}
                    >
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: ts.color, background: ts.bg }}
                    >
                      {tag}
                    </span>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold" style={{ color: "#1a2332" }}>{title}</p>
                    <p className="text-[12px] mt-1 leading-snug" style={{ color: "#6b7a8d" }}>{desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Contact & Support */}
        <div className="flex flex-col gap-5">
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(135deg, #0A1F2E 0%, #0F2A3D 100%)",
              boxShadow: "0 2px 16px -4px rgba(15,42,61,0.20)",
            }}
          >
            <h3 className="text-[15px] font-bold text-white mb-4">Contact Support</h3>
            <div className="space-y-4">
              <a
                href="mailto:support@esrimalawi.mw"
                className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                <Mail className="h-4 w-4 text-white/70 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">Email</p>
                  <p className="text-[12.5px] font-semibold text-white">support@esrimalawi.mw</p>
                </div>
              </a>
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                <Phone className="h-4 w-4 text-white/70 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">Hotline</p>
                  <p className="text-[12.5px] font-semibold text-white">+265 1 789 200</p>
                </div>
              </div>
              <p className="text-[11.5px] text-white/50 mt-2 px-1">
                Monday – Friday, 07:30 – 17:00 CAT
              </p>
            </div>
            <button
              className="mt-5 w-full rounded-xl py-3 text-[13px] font-bold transition-all hover:opacity-90 active:scale-95"
              style={{ background: "#1F7A63", color: "#fff" }}
            >
              Get Support Now
            </button>
          </div>
        </div>
      </div>

      {/* ── FAQ Section ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-[19px] font-bold mb-4" style={{ color: "#0F2A3D" }}>
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <FAQItem key={faq.q} {...faq} />
          ))}
        </div>
      </div>
    </div>
  )
}
