"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Mail, Phone, User, CheckCircle, MapPin, Search, ChevronDown,
  Clock, Video, Send, ArrowRight
} from "lucide-react"

export default function SupportCenterPage() {
  const [issueCategory, setIssueCategory] = useState("Other")
  
  return (
    <div className="w-full max-w-[1000px] mx-auto space-y-8">
      
      {/* ── Header Section ──────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <span 
          className="inline-block px-3 py-1 rounded-full text-[13px] font-bold tracking-wide uppercase"
          style={{ background: "#DFF5E3", color: "#2E8B57" }}
        >
          Support Center
        </span>
        <h1 className="text-4xl font-bold tracking-tight" style={{ color: "#0F2A3D" }}>
          How can we help you today?
        </h1>
        <p className="max-w-3xl text-[15px] leading-relaxed" style={{ color: "#6b7a8d" }}>
          Get in touch with our climate experts and technical support team for assistance with
          ESRI Malawi systems.
        </p>
      </div>

      {/* ── Contact Section ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        
        {/* Left Card: Official DCCMS Office */}
        <div 
          className="relative bg-white rounded-2xl p-7 flex flex-col justify-between"
          style={{ boxShadow: "0 4px 20px -6px rgba(15,42,61,0.08), 0 0 0 1px #e2e8f0" }}
        >
          {/* Badge */}
          <div className="absolute top-6 right-6 flex items-center gap-1.5 bg-[#f0f4f8] px-3 py-1.5 rounded-full">
            <CheckCircle className="w-4 h-4" style={{ color: "#1F7A63" }} />
            <span className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: "#0F2A3D" }}>
              Main Point of Contact
            </span>
          </div>

          <div className="pr-40">
            <h2 className="text-xl font-bold" style={{ color: "#0F2A3D" }}>Official DCCMS Office</h2>
            <p className="text-[13.5px] mt-1 pr-6" style={{ color: "#6b7a8d" }}>
              Department of Climate Change and Meteorological Services
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-7">
            
            {/* Contact Details */}
            <div className="space-y-5">
              <div className="flex gap-3 items-start">
                <div className="p-2 rounded-full bg-[#f0f4f8]">
                  <User className="w-[18px] h-[18px]" style={{ color: "#0F2A3D" }} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#6b7a8d" }}>CEO</p>
                  <p className="text-[14px] font-semibold mt-0.5" style={{ color: "#1a2332" }}>Christopher Msowoya</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="p-2 rounded-full bg-[#f0f4f8]">
                  <Mail className="w-[18px] h-[18px]" style={{ color: "#0F2A3D" }} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#6b7a8d" }}>Email Address</p>
                  <a href="mailto:christopher326msowoya@gmail.com" className="text-[14px] font-semibold mt-0.5 break-all hover:underline" style={{ color: "#1a2332" }}>
                    christopher326msowoya
                    @gmail.com
                  </a>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="p-2 rounded-full bg-[#f0f4f8]">
                  <Phone className="w-[18px] h-[18px]" style={{ color: "#0F2A3D" }} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#6b7a8d" }}>Official Phone</p>
                  <p className="text-[14px] font-semibold mt-0.5" style={{ color: "#1a2332" }}>+265994802422</p>
                </div>
              </div>
            </div>

            {/* GPS-Pinned Office Map */}
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4" style={{ color: "#1F7A63" }} />
                <p className="text-[13px] font-bold" style={{ color: "#0F2A3D" }}>Office Location</p>
              </div>
              
              {/* OpenStreetMap embed — DCCMS Blantyre office pin */}
              <div className="w-full h-36 rounded-lg overflow-hidden mb-3" style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }}>
                <iframe
                  title="DCCMS Office Location"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=34.988%2C-15.804%2C35.008%2C-15.784&amp;layer=mapnik&amp;marker=-15.794%2C34.998"
                />
              </div>
              
              <p className="text-[12.5px] leading-snug" style={{ color: "#6b7a8d" }}>
                P.O. Box 2, Blantyre<br/>
                Malawi, Central Africa
              </p>
            </div>
          </div>
        </div>

        {/* Right Contacts (Experts) */}
        <div className="flex flex-col gap-6">
          
          <div 
            className="bg-white rounded-2xl p-6 transition-all hover:shadow-md"
            style={{ boxShadow: "0 2px 14px -4px rgba(15,42,61,0.06), 0 0 0 1px #e2e8f0" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[16px] font-bold" style={{ color: "#0F2A3D" }}>Edison Chinzumba</p>
                <p className="text-[11px] font-bold uppercase tracking-wider mt-1" style={{ color: "#1F7A63" }}>Technical Director</p>
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Phone className="w-[14px] h-[14px]" style={{ color: "#6b7a8d" }} />
                <span className="text-[13.5px] font-medium" style={{ color: "#1a2332" }}>+265 888 123 456</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-[14px] h-[14px]" style={{ color: "#6b7a8d" }} />
                <span className="text-[13.5px] font-medium" style={{ color: "#1a2332" }}>edison.c@met.gov.mw</span>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-2xl p-6 transition-all hover:shadow-md"
            style={{ boxShadow: "0 2px 14px -4px rgba(15,42,61,0.06), 0 0 0 1px #e2e8f0" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[16px] font-bold" style={{ color: "#0F2A3D" }}>Benandetta Damiano</p>
                <p className="text-[11px] font-bold uppercase tracking-wider mt-1" style={{ color: "#1F7A63" }}>Public Relations Lead</p>
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Phone className="w-[14px] h-[14px]" style={{ color: "#6b7a8d" }} />
                <span className="text-[13.5px] font-medium" style={{ color: "#1a2332" }}>+265 999 876 543</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-[14px] h-[14px]" style={{ color: "#6b7a8d" }} />
                <span className="text-[13.5px] font-medium" style={{ color: "#1a2332" }}>benandetta.d@met.gov.mw</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Message Section ─────────────────────────────────────────────────────── */}
      <div 
        className="mt-8 rounded-[24px] p-10 overflow-hidden" 
        style={{ background: "#0F2A3D" }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Text */}
          <div className="text-white pr-4">
            <h2 className="text-[28px] font-bold tracking-tight">Send us a direct message</h2>
            <p className="text-[15px] mt-4 leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
              Our technical support desk operates Monday through Friday, 8:00 AM to 4:30 PM CAT. 
              We typically respond within 24 hours.
            </p>
            
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <p className="text-[14px]" style={{ color: "rgba(255,255,255,0.85)" }}>
                  Average Response Time: <span className="font-bold text-white">4 hours</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <Video className="w-4 h-4 text-white" />
                </div>
                <p className="text-[14px]" style={{ color: "rgba(255,255,255,0.85)" }}>
                  Available for Video Consultation upon request.
                </p>
              </div>
            </div>
          </div>

          {/* Right Form */}
          <div className="bg-white rounded-[16px] p-6 lg:p-8" style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#6b7a8d" }}>Full Name</label>
                <input 
                  type="text" 
                  placeholder="John Doe" 
                  className="w-full bg-[#f8fafc] border-none rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#0F2A3D]/20 transition-all font-medium text-[#1a2332]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#6b7a8d" }}>District</label>
                <div className="relative">
                  <select className="w-full bg-[#f8fafc] border-none rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#0F2A3D]/20 transition-all appearance-none cursor-pointer font-medium text-[#1a2332]">
                    <option>Lilongwe</option>
                    <option>Blantyre</option>
                    <option>Zomba</option>
                    <option>Mzuzu</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7a8d] pointer-events-none" />
                </div>
              </div>
            </div>
            
            <div className="mb-5">
              <label className="block text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#6b7a8d" }}>Email Address</label>
              <input 
                type="email" 
                placeholder="name@domain.com" 
                className="w-full bg-[#f8fafc] border-none rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#0F2A3D]/20 transition-all font-medium text-[#1a2332]"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#6b7a8d" }}>Issue Category</label>
              <div className="flex flex-wrap gap-2">
                {["Data Error", "Login Issue", "Other"].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setIssueCategory(cat)}
                    className="px-4 py-1.5 rounded-full text-[12.5px] font-semibold transition-all"
                    style={
                      issueCategory === cat 
                      ? { background: "#0F2A3D", color: "#fff" }
                      : { background: "#f0f4f8", color: "#6b7a8d" }
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#6b7a8d" }}>Your Message</label>
              <textarea 
                placeholder="How can we assist you?" 
                rows={4}
                className="w-full bg-[#f8fafc] border-none rounded-xl px-4 py-3 text-[14px] outline-none focus:ring-2 focus:ring-[#0F2A3D]/20 transition-all resize-none font-medium text-[#1a2332]"
              ></textarea>
            </div>

            <button 
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-bold transition-all hover:scale-[0.99] active:scale-[0.97]"
              style={{ background: "#0F2A3D", color: "#fff", boxShadow: "0 4px 12px rgba(15,42,61,0.2)" }}
            >
              Send Message
              <Send className="w-4 h-4 ml-1" />
            </button>
          </div>

        </div>
      </div>

      {/* ── Footer Hint ───────────────────────────────────────────────────────── */}
      <div className="pt-6 pb-8 text-center flex flex-col items-center justify-center bg-transparent mt-2">
        <p className="text-[13.5px] mb-2" style={{ color: "#6b7a8d" }}>Looking for immediate answers?</p>
        <Link 
          href="/help" 
          className="group flex items-center gap-1.5 text-[14px] font-bold transition-all"
           style={{ color: "#0F2A3D" }}
        >
          Browse our Knowledge Base
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

    </div>
  )
}
