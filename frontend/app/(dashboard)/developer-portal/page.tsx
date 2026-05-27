"use client"

import { Download, Zap } from "lucide-react"

export default function DeveloperPortalPage() {
  return (
    <div className="space-y-8 max-w-full">
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
                  <li>Real-time weather data</li>
                  <li>Historical climate records</li>
                  <li>Risk assessment APIs</li>
                  <li>Satellite imagery access</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-[#0F2A3D]">Use Cases:</h4>
                <ul className="text-sm text-[#6b7a8d] space-y-1">
                  <li>Farm management software</li>
                  <li>Insurance risk modeling</li>
                  <li>Supply chain optimization</li>
                  <li>Research applications</li>
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
