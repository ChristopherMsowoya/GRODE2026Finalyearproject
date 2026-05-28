"use client"

import { MapPin } from "lucide-react"
import { useUser } from "@/lib/user-context"
import { MobileSidebar } from "./app-sidebar"

export function AppHeader() {
  const { user } = useUser()

  return (
    <header className="flex h-16 items-center justify-between border-b border-[#e2e8f0] bg-white px-3 sm:px-4 md:px-8 flex-shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 md:gap-10">
        <MobileSidebar />
        <div className="hidden sm:flex items-center gap-3">
          <span className="text-[15px] sm:text-[17px] font-bold tracking-tight" style={{ color: "#0F2A3D" }}>
            GRODE MW
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
        {user ? (
          <button className="hidden sm:flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-2.5 md:px-3.5 py-1.5 sm:py-2 text-[12px] sm:text-[13px] font-medium text-[#1a2332] transition-all duration-200 hover:bg-[#f0f4f8] hover:shadow-sm">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-[#1F7A63]" />
            <span className="hidden md:inline">
              {(() => {
                const map: Record<string, string> = {
                  lilongwe: "Lilongwe",
                  blantyre: "Blantyre",
                  mzimba: "Mzimba",
                  zomba: "Zomba",
                  dedza: "Dedza",
                  mchinji: "Mchinji",
                  salima: "Salima",
                  nkhotakota: "Nkhotakota",
                  kasungu: "Kasungu",
                }
                return map[user.district] ?? user.district
              })()}
            </span>
          </button>
        ) : null}
      </div>
    </header>
  )
}
