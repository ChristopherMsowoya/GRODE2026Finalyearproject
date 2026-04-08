"use client"

import { useState } from "react"
import { Calendar, Clock, Users, MapPin, Phone, Mail, CheckCircle, Star } from "lucide-react"

const SERVICES = [
  {
    id: "farm-assessment",
    title: "Farm Assessment & Planning",
    description: "Comprehensive evaluation of your farm's climate vulnerability and optimization opportunities",
    duration: "2-3 days",
    price: "MWK 25,000",
    features: [
      "On-site soil and crop analysis",
      "Climate risk assessment",
      "Custom planting calendar",
      "Irrigation system recommendations",
      "Yield optimization strategy"
    ]
  },
  {
    id: "training-workshop",
    title: "Farmer Training Workshop",
    description: "Hands-on training for farmers and cooperatives on climate-smart agriculture practices",
    duration: "1-2 days",
    price: "MWK 50,000",
    features: [
      "Climate adaptation techniques",
      "Modern farming technologies",
      "Risk management strategies",
      "Group discussions and Q&A",
      "Training materials provided"
    ]
  },
  {
    id: "cooperative-support",
    title: "Cooperative Development",
    description: "Support for agricultural cooperatives in implementing climate-resilient practices",
    duration: "1 week",
    price: "MWK 100,000",
    features: [
      "Cooperative assessment",
      "Climate strategy development",
      "Member training programs",
      "Technology integration",
      "Monitoring and evaluation setup"
    ]
  },
  {
    id: "emergency-response",
    title: "Emergency Climate Response",
    description: "Rapid assessment and response planning for climate-related agricultural emergencies",
    duration: "1-2 days",
    price: "MWK 35,000",
    features: [
      "Emergency assessment",
      "Damage evaluation",
      "Recovery planning",
      "Alternative crop recommendations",
      "Government aid coordination"
    ]
  }
]

const EXPERTS = [
  {
    name: "Dr. Christopher Msowoya",
    title: "Chief Climatologist",
    specialization: "Climate Modeling & Risk Assessment",
    experience: "15+ years",
    rating: 4.9,
    reviews: 127,
    image: "CM",
    available: true
  },
  {
    name: "Edison Chinzumba",
    title: "Agricultural Engineer",
    specialization: "Irrigation & Farm Technology",
    experience: "12+ years",
    rating: 4.8,
    reviews: 89,
    image: "EC",
    available: true
  },
  {
    name: "Dr. Mary Chilenga",
    title: "Soil Scientist",
    specialization: "Soil Health & Fertility",
    experience: "18+ years",
    rating: 5.0,
    reviews: 156,
    image: "MC",
    available: false
  }
]

function ServiceCard({ service }: { service: typeof SERVICES[0] }) {
  const [selected, setSelected] = useState(false)

  return (
    <div className={`rounded-2xl p-6 border-2 transition-all cursor-pointer ${
      selected ? "border-[#1F7A63] bg-[#E9F5EC]" : "border-[#e2e8f0] bg-white hover:shadow-md"
    }`} onClick={() => setSelected(!selected)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-[#0F2A3D]">{service.title}</h3>
          <p className="text-sm text-[#6b7a8d] mt-1">{service.description}</p>
        </div>
        {selected && <CheckCircle className="h-6 w-6 text-[#1F7A63] flex-shrink-0" />}
      </div>

      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-[#6b7a8d]" />
          <span>{service.duration}</span>
        </div>
        <div className="font-bold text-[#1F7A63]">{service.price}</div>
      </div>

      <ul className="space-y-2">
        {service.features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-[#1F7A63] flex-shrink-0" />
            <span className="text-[#6b7a8d]">{feature}</span>
          </li>
        ))}
      </ul>

      <button className={`w-full mt-6 py-3 rounded-xl font-bold text-sm transition-all ${
        selected
          ? "bg-[#1F7A63] text-white hover:opacity-90"
          : "border border-[#e2e8f0] text-[#6b7a8d] hover:bg-[#f0f4f8]"
      }`}>
        {selected ? "Book This Service" : "Select Service"}
      </button>
    </div>
  )
}

function ExpertCard({ expert }: { expert: typeof EXPERTS[0] }) {
  return (
    <div className="rounded-2xl bg-white p-6 border border-[#e2e8f0]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1F7A63] text-white font-bold text-lg flex-shrink-0">
          {expert.image}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-bold text-[#0F2A3D]">{expert.name}</h3>
              <p className="text-sm text-[#6b7a8d]">{expert.title}</p>
            </div>
            <div className={`px-2 py-1 rounded-full text-xs font-bold ${
              expert.available ? "bg-[#E9F5EC] text-[#1F7A63]" : "bg-[#f0f4f8] text-[#6b7a8d]"
            }`}>
              {expert.available ? "Available" : "Busy"}
            </div>
          </div>

          <p className="text-sm text-[#6b7a8d] mb-3">{expert.specialization}</p>

          <div className="flex items-center gap-4 text-sm text-[#6b7a8d]">
            <span>{expert.experience}</span>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-[#F4A261] text-[#F4A261]" />
              <span>{expert.rating}</span>
              <span>({expert.reviews})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConsultingPage() {
  const [selectedServices, setSelectedServices] = useState<string[]>([])

  return (
    <div className="space-y-8 max-w-full">
      {/* Header */}
      <div>
        <h1 className="text-[36px] font-extrabold tracking-tight leading-tight" style={{ color: "#0F2A3D" }}>
          Expert Consulting Services
        </h1>
        <p className="mt-1 text-[15px] leading-relaxed" style={{ color: "#6b7a8d" }}>
          Get personalized guidance from Malawi's leading agricultural and climate experts to optimize your farming operations.
        </p>
      </div>

      {/* Services Grid */}
      <div>
        <h2 className="text-xl font-bold text-[#0F2A3D] mb-6">Available Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SERVICES.map(service => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </div>

      {/* Experts */}
      <div>
        <h2 className="text-xl font-bold text-[#0F2A3D] mb-6">Our Expert Consultants</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {EXPERTS.map(expert => (
            <ExpertCard key={expert.name} expert={expert} />
          ))}
        </div>
      </div>

      {/* Booking Form */}
      <div className="rounded-2xl bg-white p-8 border border-[#e2e8f0]">
        <h2 className="text-xl font-bold text-[#0F2A3D] mb-6">Book a Consultation</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#0F2A3D] mb-2">Full Name</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/20"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0F2A3D] mb-2">Phone Number</label>
              <input
                type="tel"
                className="w-full px-4 py-3 border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/20"
                placeholder="+265 XXX XXX XXX"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0F2A3D] mb-2">District</label>
              <select className="w-full px-4 py-3 border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/20">
                <option>Lilongwe</option>
                <option>Blantyre</option>
                <option>Zomba</option>
                <option>Mzuzu</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#0F2A3D] mb-2">Preferred Date</label>
              <input
                type="date"
                className="w-full px-4 py-3 border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0F2A3D] mb-2">Service Type</label>
              <select className="w-full px-4 py-3 border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/20">
                <option>Farm Assessment</option>
                <option>Training Workshop</option>
                <option>Cooperative Support</option>
                <option>Emergency Response</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0F2A3D] mb-2">Additional Notes</label>
              <textarea
                rows={3}
                className="w-full px-4 py-3 border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/20 resize-none"
                placeholder="Tell us about your specific needs..."
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#f0f4f8]">
          <div className="text-sm text-[#6b7a8d]">
            <p>Consultation fees start from MWK 25,000</p>
            <p>Response within 24 hours</p>
          </div>
          <button className="px-8 py-3 bg-[#1F7A63] text-white font-bold rounded-xl hover:opacity-90 transition-opacity">
            Request Consultation
          </button>
        </div>
      </div>

      {/* Contact Info */}
      <div className="rounded-2xl bg-[#f8fafd] p-8 border border-[#e2e8f0]">
        <div className="text-center">
          <h3 className="text-lg font-bold text-[#0F2A3D] mb-2">Need to discuss your requirements?</h3>
          <p className="text-[#6b7a8d] mb-6">Contact our consulting team directly for urgent needs or complex projects.</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-[#1F7A63]" />
              <span className="font-semibold">+265 994 802 422</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-[#1F7A63]" />
              <span className="font-semibold">consulting@esrimalawi.mw</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}