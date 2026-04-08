"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, Map, Sun, AlertTriangle, Sprout,
  Headphones, Settings, HelpCircle, UserPlus, Menu, MessageSquare, Crown, Users
} from "lucide-react"
import { useUser } from "@/lib/user-context"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"

const navItems = [
  { name: "Dashboard",        href: "/",            icon: LayoutDashboard },
  { name: "Map",              href: "/map",          icon: Map             },
  { name: "Onset Info",       href: "/onset",        icon: Sun             },
  { name: "False-Onset",      href: "/false-onset",  icon: AlertTriangle   },
  { name: "Crop Stress",      href: "/crop-stress",  icon: Sprout          },
  { name: "Subscription",     href: "/subscription", icon: Crown           },
]

const footerNavItems = [
  { name: "Help", href: "/help", icon: HelpCircle },
]

function SidebarInner({ pathname, user }: { pathname: string, user: any }) {
  return (
    <>
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="px-6 py-7 border-b border-[#e2e8f0]">
        <div className="flex items-center gap-3">
          <svg className="h-8 w-11 rounded border border-black/5 flex-shrink-0 shadow-sm overflow-hidden" viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
            <rect width="300" height="66.66" fill="#1e1e1e"/>
            <rect y="66.66" width="300" height="66.66" fill="#CE1126"/>
            <rect y="133.33" width="300" height="66.66" fill="#339E35"/>
            <circle cx="150" cy="66.66" r="34" fill="#CE1126"/>
            <path d="M120,66.66 L130,46.66 M135,66.66 L140,40 M150,66.66 L150,35 M165,66.66 L160,40 M180,66.66 L170,46.66" stroke="#CE1126" strokeWidth="6" strokeLinecap="round"/>
          </svg>
          <div>
            <h2 className="text-[15px] font-bold leading-tight" style={{ color: "#0F2A3D" }}>Climate Intel</h2>
            <p className="text-[11px] text-[#6b7a8d]">Malawi District Portal</p>
          </div>
        </div>
      </div>

      {/* ── Main Nav ──────────────────────────────────────────────────────── */}
      <nav className="flex-1 space-y-1 px-4 py-5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-[13.5px] font-medium transition-all duration-200",
                isActive ? "nav-active text-white shadow-sm" : "text-[#6b7a8d] hover:bg-[#f0f4f8] hover:text-[#0F2A3D]"
              )}
              style={isActive ? { background: "linear-gradient(135deg,#0F2A3D 0%,#1a3d54 100%)" } : undefined}
            >
              <item.icon className={cn("h-[18px] w-[18px] flex-shrink-0", isActive ? "text-white" : "text-[#6b7a8d]")} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-6 space-y-1">
        {footerNavItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200",
                isActive ? "nav-active text-white shadow-sm" : "text-[#6b7a8d] hover:bg-[#f0f4f8] hover:text-[#0F2A3D]"
              )}
              style={isActive ? { background: "linear-gradient(135deg,#0F2A3D 0%,#1a3d54 100%)" } : undefined}
            >
              <item.icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-white" : "text-[#6b7a8d]")} />
              {item.name}
            </Link>
          )
        })}

        {/* ── User card / Create Account ─────────────────────────────────── */}
        <div className="pt-3 space-y-2">
          {!user && (
            <Link href="/create-account"
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 hover:bg-muted border border-border text-primary">
              <UserPlus className="h-4 w-4" />
              Create Account
            </Link>
          )}

          {/* Get Support always visible */}
          <Link href="/help"
            className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[13.5px] font-bold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95"
            style={{ background: "#0B6B3A", borderRadius: "999px" }}>
            <Headphones className="h-4 w-4" />
            Help & Support
          </Link>
        </div>
      </div>
    </>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useUser()

  return (
    <aside
      className="hidden md:flex h-screen flex-col border-r border-sidebar-border bg-white"
      style={{ width: "260px", minWidth: "260px" }}
    >
      <SidebarInner pathname={pathname} user={user} />
    </aside>
  )
}

export function MobileSidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="md:hidden flex items-center justify-center p-2 -ml-2 rounded-md hover:bg-[#f0f4f8] text-[#0F2A3D]">
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-[260px] flex flex-col bg-white [&>button]:hidden">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarInner pathname={pathname} user={user} />
      </SheetContent>
    </Sheet>
  )
}
