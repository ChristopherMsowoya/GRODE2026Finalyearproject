"use client"

import { useState } from "react"
import { Check, Star, Zap, Shield, TrendingUp, Download } from "lucide-react"

const PLANS = [
  {
    name: "Free",
    price: "MWK 0",
    period: "forever",
    description: "Basic climate monitoring for small farms",
    features: [
      "Basic dashboard access",
      "Weekly risk alerts",
      "Community forum access",
      "Standard support"
    ],
    limitations: [
      "Limited historical data",
      "Basic map views only",
      "No custom reports"
    ],
    popular: false,
    color: "#6b7a8d"
  },
  {
    name: "Premium",
    price: "MWK 2,500",
    period: "per month",
    description: "Advanced analytics for commercial farmers",
    features: [
      "Everything in Free",
      "Advanced analytics & predictions",
      "Historical data (10+ years)",
      "Custom reports & exports",
      "Priority expert consultation",
      "API access for integrations",
      "Mobile app access"
    ],
    limitations: [],
    popular: true,
    color: "#1F7A63"
  },
  {
    name: "Enterprise",
    price: "MWK 15,000",
    period: "per month",
    description: "Complete solution for cooperatives & agribusiness",
    features: [
      "Everything in Premium",
      "Multi-user accounts",
      "Advanced API access",
      "Custom integrations",
      "Dedicated support manager",
      "On-site training & workshops",
      "Bulk data exports"
    ],
    limitations: [],
    popular: false,
    color: "#0F2A3D"
  }
]

function PlanCard({ plan, onSelect }: { plan: typeof PLANS[0], onSelect: (plan: string) => void }) {
  return (
    <div className={`relative rounded-2xl p-6 border-2 transition-all duration-200 ${
      plan.popular
        ? "border-[#1F7A63] bg-[#E9F5EC] shadow-lg scale-105"
        : "border-[#e2e8f0] bg-white hover:shadow-md"
    }`}>
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-[#1F7A63] text-white px-4 py-1 rounded-full text-sm font-bold">
            Most Popular
          </span>
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-xl font-bold" style={{ color: plan.color }}>{plan.name}</h3>
        <div className="mt-2">
          <span className="text-3xl font-black" style={{ color: plan.color }}>{plan.price}</span>
          <span className="text-sm text-[#6b7a8d]">/{plan.period}</span>
        </div>
        <p className="text-sm text-[#6b7a8d] mt-2">{plan.description}</p>
      </div>

      <div className="space-y-3 mb-6">
        {plan.features.map((feature, i) => (
          <div key={i} className="flex items-center gap-3">
            <Check className="h-4 w-4 flex-shrink-0" style={{ color: plan.color }} />
            <span className="text-sm">{feature}</span>
          </div>
        ))}
        {plan.limitations.map((limitation, i) => (
          <div key={i} className="flex items-center gap-3 opacity-60">
            <span className="h-4 w-4 flex-shrink-0 text-[#6b7a8d]">✗</span>
            <span className="text-sm text-[#6b7a8d]">{limitation}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => onSelect(plan.name)}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
          plan.popular
            ? "bg-[#1F7A63] text-white hover:opacity-90"
            : "border border-[#e2e8f0] text-[#1a2332] hover:bg-[#f0f4f8]"
        }`}
      >
        {plan.name === "Free" ? "Current Plan" : `Upgrade to ${plan.name}`}
      </button>
    </div>
  )
}

export default function SubscriptionPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  const handlePlanSelect = (planName: string) => {
    setSelectedPlan(planName)
    // In a real app, this would integrate with payment processing
    alert(`Selected ${planName} plan. Payment integration would be implemented here.`)
  }

  return (
    <div className="space-y-8 max-w-full">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-[36px] font-extrabold tracking-tight leading-tight" style={{ color: "#0F2A3D" }}>
          Choose Your Plan
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed max-w-2xl mx-auto" style={{ color: "#6b7a8d" }}>
          Unlock advanced climate intelligence features to optimize your farming operations and maximize yields.
        </p>
      </div>

      {/* Benefits Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center p-6 rounded-2xl bg-white border border-[#e2e8f0]">
          <Star className="h-8 w-8 mx-auto mb-3" style={{ color: "#F4A261" }} />
          <h3 className="font-bold text-[#0F2A3D] mb-2">Expert Insights</h3>
          <p className="text-sm text-[#6b7a8d]">Access to premium weather models and expert analysis</p>
        </div>
        <div className="text-center p-6 rounded-2xl bg-white border border-[#e2e8f0]">
          <TrendingUp className="h-8 w-8 mx-auto mb-3" style={{ color: "#1F7A63" }} />
          <h3 className="font-bold text-[#0F2A3D] mb-2">Yield Optimization</h3>
          <p className="text-sm text-[#6b7a8d]">Data-driven recommendations to increase productivity</p>
        </div>
        <div className="text-center p-6 rounded-2xl bg-white border border-[#e2e8f0]">
          <Shield className="h-8 w-8 mx-auto mb-3" style={{ color: "#0F2A3D" }} />
          <h3 className="font-bold text-[#0F2A3D] mb-2">Risk Mitigation</h3>
          <p className="text-sm text-[#6b7a8d]">Advanced early warning systems for climate risks</p>
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map(plan => (
          <PlanCard key={plan.name} plan={plan} onSelect={handlePlanSelect} />
        ))}
      </div>

      {/* API Access Section */}
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
              Integrate ESRI Climate data into your own applications. Available with Premium and Enterprise plans.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-[#0F2A3D]">Available Endpoints:</h4>
                <ul className="text-sm text-[#6b7a8d] space-y-1">
                  <li>• Real-time weather data</li>
                  <li>• Historical climate records</li>
                  <li>• Risk assessment APIs</li>
                  <li>• Satellite imagery access</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-[#0F2A3D]">Use Cases:</h4>
                <ul className="text-sm text-[#6b7a8d] space-y-1">
                  <li>• Farm management software</li>
                  <li>• Insurance risk modeling</li>
                  <li>• Supply chain optimization</li>
                  <li>• Research applications</li>
                </ul>
              </div>
            </div>
            <button className="mt-6 px-6 py-3 bg-[#0F2A3D] text-white font-bold rounded-xl hover:opacity-90 transition-opacity">
              <Download className="h-4 w-4 inline mr-2" />
              View API Documentation
            </button>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-2xl bg-white p-8 border border-[#e2e8f0]">
        <h3 className="text-xl font-bold text-[#0F2A3D] mb-6">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-[#0F2A3D]">Can I change plans anytime?</h4>
            <p className="text-sm text-[#6b7a8d] mt-1">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
          </div>
          <div>
            <h4 className="font-semibold text-[#0F2A3D]">Is there a free trial for Premium?</h4>
            <p className="text-sm text-[#6b7a8d] mt-1">Yes, we offer a 14-day free trial for all Premium features. No credit card required.</p>
          </div>
          <div>
            <h4 className="font-semibold text-[#0F2A3D]">What payment methods do you accept?</h4>
            <p className="text-sm text-[#6b7a8d] mt-1">We accept Airtel Money, TNM Mpamba, and bank transfers for Malawian users.</p>
          </div>
        </div>
      </div>
    </div>
  )
}