"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Star, Phone, Calendar, ChevronRight, ArrowLeft,
  MapPin, Search, Filter
} from "lucide-react"

// ─── Expert data ─────────────────────────────────────────────────────────────
const EXPERTS = [
  {
    name: "Christopher Msowoya",
    rating: 4.9,
    specialty: "Climate Adaptive Strategy",
    specialtyColor: "#16A34A",
    description:
      "Specialist in maize-variant selection for high-risk false-onset zones in the Central Region of Malawi.",
    avatar: "CM",
    avatarBg: "#0B3C49",
    location: "Lilongwe",
    available: true,
  },
  {
    name: "Edison Chinzumba",
    rating: 5.0,
    specialty: "Hydrology & Irrigation",
    specialtyColor: "#16A34A",
    description:
      "Focuses on small-scale solar irrigation systems to mitigate dry spells and false-onset crop losses.",
    avatar: "EC",
    avatarBg: "#0E6B5C",
    location: "Blantyre",
    available: true,
  },
  {
    name: "Bennandetta Damiano",
    rating: 4.8,
    specialty: "Entomologist",
    specialtyColor: "#16A34A",
    description:
      "Expert in Fall Armyworm mitigation during erratic rainfall patterns and post-onset vulnerability periods.",
    avatar: "BD",
    avatarBg: "#164E36",
    location: "Zomba",
    available: false,
  },
  {
    name: "Stewart Mangame",
    rating: 4.9,
    specialty: "Agri-Business Advisor",
    specialtyColor: "#16A34A",
    description:
      "Financial risk management and crop insurance specialist for commercial smallholder cooperatives.",
    avatar: "SM",
    avatarBg: "#374151",
    location: "Mzuzu",
    available: true,
  },
]

const SPECIALTY_FILTERS = [
  "All Experts",
  "Soil Science",
  "Climatology",
  "Crop Protection",
  "Irrigation",
]

// ─── Page ────────────────────────────────────────────────────────────────────
export default function ExpertAdvicePage() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState("All Experts")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredExperts = EXPERTS.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-full">

      {/* ── Page Header with back nav ────────────────────────────────────── */}
      <div>
        {/* Breadcrumb */}
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold transition-colors hover:opacity-70"
          style={{ color: "#6b7a8d" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to False-Onset Risk
        </button>

        {/* Breadcrumb trail */}
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#6b7a8d" }}>
            Intelligence
          </span>
          <ChevronRight className="h-3 w-3" style={{ color: "#6b7a8d" }} />
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#6b7a8d" }}>
            False-Onset Risk
          </span>
          <ChevronRight className="h-3 w-3" style={{ color: "#6b7a8d" }} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#0B3C49" }}>
            Expert Advice
          </span>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <h1
              className="text-[36px] font-extrabold tracking-tight leading-tight"
              style={{ color: "#0F2A3D" }}
            >
              Precision Guidance
            </h1>
            <p className="mt-1 text-[15px] leading-relaxed" style={{ color: "#6b7a8d" }}>
              Connect with Malawi&apos;s leading agricultural expert to
              navigate false-onset risks and optimize your planting window.
            </p>
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 flex-shrink-0"
            style={{ background: "white", border: "1.5px solid #e2e8f0", minWidth: "240px" }}
          >
            <Search className="h-4 w-4 flex-shrink-0" style={{ color: "#6b7a8d" }} />
            <input
              type="text"
              placeholder="Search experts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[13px] outline-none w-full"
              style={{ color: "#0F2A3D" }}
            />
          </div>
        </div>
      </div>

      {/* ── Main layout: Filter left + grid right ──────────────────────── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "280px 1fr" }}>

        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-5">

          {/* Specialties filter */}
          <div
            className="rounded-2xl bg-white p-5"
            style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4" style={{ color: "#6b7a8d" }} />
              <h3 className="text-[14px] font-bold" style={{ color: "#0F2A3D" }}>
                Filter by Specialty
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-all duration-200"
                  style={{
                    background: activeFilter === filter ? "#0B3C49" : "transparent",
                    color: activeFilter === filter ? "white" : "#374151",
                    border: activeFilter === filter ? "1.5px solid #0B3C49" : "1.5px solid #e2e8f0",
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Expert grid */}
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-5">
            {filteredExperts.map((expert) => (
              <div
                key={expert.name}
                className="rounded-2xl bg-white p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-md"
                style={{ boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}
              >
                {/* Top row: avatar + rating */}
                <div className="flex items-start justify-between">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-[14px] flex-shrink-0"
                    style={{ background: expert.avatarBg }}
                  >
                    {expert.avatar}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" style={{ color: "#F4A261", fill: "#F4A261" }} />
                      <span className="text-[13px] font-bold" style={{ color: "#1a2332" }}>
                        {expert.rating.toFixed(1)}
                      </span>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={
                        expert.available
                          ? { background: "rgba(22,163,74,0.10)", color: "#16A34A", border: "1px solid rgba(22,163,74,0.2)" }
                          : { background: "#f0f4f8", color: "#6b7a8d", border: "1px solid #e2e8f0" }
                      }
                    >
                      {expert.available ? "Available" : "Busy"}
                    </span>
                  </div>
                </div>

                {/* Name & specialty */}
                <div>
                  <h3 className="text-[14.5px] font-bold" style={{ color: "#0F2A3D" }}>
                    {expert.name}
                  </h3>
                  <p className="text-[12px] font-semibold" style={{ color: expert.specialtyColor }}>
                    {expert.specialty}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" style={{ color: "#6b7a8d" }} />
                    <span className="text-[11.5px]" style={{ color: "#6b7a8d" }}>{expert.location}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[12.5px] leading-relaxed flex-1" style={{ color: "#6b7a8d" }}>
                  {expert.description}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "#f0f4f8" }}>
                  <a
                    href="https://wa.me/265994802422"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
                    style={{
                      background: "#25D366",
                      color: "#fff",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.524 5.843L0 24l6.344-1.504A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.491-5.24-1.352l-.374-.222-3.876.919.978-3.78-.243-.388A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    </svg>
                    WhatsApp Chatbot
                  </a>
                  <button
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200 hover:bg-gray-100 active:scale-95"
                    style={{ border: "1.5px solid #e2e8f0" }}
                  >
                    <Phone className="h-3.5 w-3.5" style={{ color: "#0B3C49" }} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Support banner */}
          <div
            className="flex items-center justify-between rounded-2xl p-6"
            style={{
              background: "white",
              boxShadow: "0 2px 16px -4px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0",
            }}
          >
            <div>
              <h3 className="text-[16px] font-extrabold" style={{ color: "#0F2A3D" }}>
                Need urgent technical assistance?
              </h3>
              <p className="text-[13px] mt-0.5" style={{ color: "#6b7a8d" }}>
                Our support center is available for on-the-ground field visits across Malawi.
              </p>
            </div>
            <button
              className="flex items-center gap-2 rounded-xl px-6 py-3 text-[13.5px] font-bold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95 flex-shrink-0 ml-6"
              style={{ background: "#16A34A" }}
            >
              Contact Support Unit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
