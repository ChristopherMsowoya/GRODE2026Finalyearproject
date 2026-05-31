import { Bell, Database, Globe2, MapPin, ShieldCheck, SlidersHorizontal } from "lucide-react"

const settingsSections = [
  {
    icon: MapPin,
    title: "Location Preferences",
    description: "Choose the district and searched area used as the default geographical focus for grid-level rainfall diagnostics.",
    items: ["Default district", "Selected area search", "Nearest 5km rainfall grid cell"],
  },
  {
    icon: SlidersHorizontal,
    title: "Diagnostic Display",
    description: "Control how onset, false-onset, and dry-spell information is interpreted across maps, graphs, and grid widgets.",
    items: ["Onset level", "False onset level", "Dry spell level"],
  },
  {
    icon: Database,
    title: "Data Source",
    description: "GRODE uses CHIRPS rainfall data and Malawi boundary layers to generate diagnostics at grid-cell level.",
    items: ["CHIRPS rainfall seasons", "5km ESRI grid", "District and area boundaries"],
  },
  {
    icon: Bell,
    title: "Alerts & Notifications",
    description: "Notification settings can be used for rainfall onset alerts, high false-onset risk, and dry-spell warnings.",
    items: ["Risk alerts", "Seasonal updates", "System messages"],
  },
  {
    icon: Globe2,
    title: "Region & Language",
    description: "The system is currently configured for Malawi districts and rainfall seasons from November to April.",
    items: ["Malawi coverage", "CAT timezone", "Rainy season calendar"],
  },
  {
    icon: ShieldCheck,
    title: "Account & Access",
    description: "User access controls protect project data while allowing team members to review diagnostics for presentation and testing.",
    items: ["Local user session", "Developer access", "Support contact"],
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#0F2A3D]">Settings</h1>
        <p className="mt-1 max-w-3xl text-base leading-7 text-[#4b5563]">
          Manage how GRODE selects locations, displays grid diagnostics, and connects rainfall data to onset, false-onset, and dry-spell outputs.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {settingsSections.map(({ icon: Icon, title, description, items }) => (
          <section key={title} className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#eef7f4] text-[#1F7A63]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-[#0F2A3D]">{title}</h2>
                <p className="mt-1 text-[13.5px] leading-6 text-[#6b7a8d]">{description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {items.map((item) => (
                    <span key={item} className="rounded-full border border-[#dceee8] bg-[#f3faf7] px-3 py-1 text-[11.5px] font-semibold text-[#315f52]">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
