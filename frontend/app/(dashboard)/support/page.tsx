import { Mail, Phone, MessageSquare, Clock } from "lucide-react"

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#0F2A3D]">Support</h1>
        <p className="mt-1 max-w-3xl text-base leading-7 text-[#4b5563]">
          Contact the GRODE support team for help with district selection, area search, map visualization, API access, and rainfall diagnostic outputs.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <a href="mailto:support@esrimalawi.mw?subject=GRODE%20Support%20Request" className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm transition hover:border-[#1F7A63]/40">
          <Mail className="h-6 w-6 text-[#1F7A63]" />
          <h2 className="mt-4 text-[16px] font-bold text-[#0F2A3D]">Email Support</h2>
          <p className="mt-1 text-[13px] text-[#6b7a8d]">support@esrimalawi.mw</p>
        </a>

        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <Phone className="h-6 w-6 text-[#1F7A63]" />
          <h2 className="mt-4 text-[16px] font-bold text-[#0F2A3D]">Call Hotline</h2>
          <p className="mt-1 text-[13px] text-[#6b7a8d]">+265 1 789 200</p>
        </div>

        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <Clock className="h-6 w-6 text-[#1F7A63]" />
          <h2 className="mt-4 text-[16px] font-bold text-[#0F2A3D]">Office Hours</h2>
          <p className="mt-1 text-[13px] text-[#6b7a8d]">Monday to Friday, 07:30 to 17:00 CAT</p>
        </div>
      </div>

      <section className="rounded-xl border border-[#dceee8] bg-[#f3faf7] p-5">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#1F7A63]" />
          <div>
            <h2 className="text-[16px] font-bold text-[#0F2A3D]">What to include in a support request</h2>
            <p className="mt-1 text-[13.5px] leading-6 text-[#315f52]">
              Include the page name, selected district, searched area, grid ID if visible, and what result looked incorrect. This helps the team trace the exact grid-level diagnostic output.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
