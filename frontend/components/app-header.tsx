"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MapPin, User, LogOut, ChevronDown, Phone, Mail, Pencil, Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser, getInitials } from "@/lib/user-context"
import { MobileSidebar } from "./app-sidebar"
import { NotificationsPanel, useNotifications, type NotificationItem } from "./notifications"

// ─── Initials avatar ──────────────────────────────────────────────────────────
function InitialsAvatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white select-none"
      style={{
        width: size, height: size, fontSize: size * 0.35,
        background: "linear-gradient(135deg,#0F2A3D 0%,#1F7A63 100%)",
      }}
    >
      {initials}
    </div>
  )
}

// ─── Profile dropdown ────────────────────────────────────────────────────────
function ProfileDropdown({ onClose }: { onClose: () => void }) {
  const { user, logout } = useUser()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    onClose()
    router.push("/")
  }

  if (!user) return null

  const DISTRICTS: Record<string, string> = {
    "balaka": "Balaka", "blantyre": "Blantyre", "chikwawa": "Chikwawa",
    "chiradzulu": "Chiradzulu", "chitipa": "Chitipa", "dedza": "Dedza",
    "dowa": "Dowa", "karonga": "Karonga", "kasungu": "Kasungu",
    "likoma": "Likoma", "lilongwe": "Lilongwe", "machinga": "Machinga",
    "mangochi": "Mangochi", "mchinji": "Mchinji", "mulanje": "Mulanje",
    "mwanza": "Mwanza", "mzimba": "Mzimba", "neno": "Neno",
    "nkhata-bay": "Nkhata Bay", "nkhotakota": "Nkhotakota", "nsanje": "Nsanje",
    "ntcheu": "Ntcheu", "ntchisi": "Ntchisi", "phalombe": "Phalombe",
    "rumphi": "Rumphi", "salima": "Salima", "thyolo": "Thyolo", "zomba": "Zomba",
  }
  const districtLabel = DISTRICTS[user.district] ?? user.district

  return (
    <div
      className="absolute right-0 top-full mt-2 w-[300px] rounded-2xl bg-white overflow-hidden z-50"
      style={{ boxShadow: "0 20px 60px -8px rgba(0,0,0,0.18), 0 0 0 1px #e2e8f0" }}
    >
      {/* Header */}
      <div className="p-5" style={{ background: "linear-gradient(135deg,#0F2A3D 0%,#1a3d54 70%,#1F7A63 100%)" }}>
        <div className="flex items-center gap-3">
          <InitialsAvatar initials={getInitials(user)} size={44} />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-white truncate">
              {user.firstName} {user.lastName}
            </p>
            <span
              className="inline-block mt-0.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide"
              style={{
                background: user.role === "farmer" ? "rgba(244,162,97,0.25)" : "rgba(31,122,99,0.35)",
                color: user.role === "farmer" ? "#F4A261" : "#7de0c8",
              }}
            >
              {user.role === "farmer" ? "🌾 Farmer" : "🔬 Agronomist"}
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        {[
          { icon: Mail, label: user.email },
          ...(user.phone ? [{ icon: Phone, label: user.phone }] : []),
          { icon: MapPin, label: districtLabel + " District" },
          ...(user.location?.label ? [{ icon: MapPin, label: user.location.label }] : []),
        ].map(({ icon: Icon, label }, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#6b7a8d" }} />
            <span className="text-[12.5px] truncate" style={{ color: "#1a2332" }}>{label}</span>
          </div>
        ))}

        {user.crops.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {user.crops.slice(0, 4).map((c) => (
              <span key={c} className="rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold"
                style={{ background: "rgba(31,122,99,0.1)", color: "#1F7A63" }}>{c}</span>
            ))}
            {user.crops.length > 4 && (
              <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold"
                style={{ background: "#f0f4f8", color: "#6b7a8d" }}>+{user.crops.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-[#f0f4f8] p-3 space-y-1">
        <Link href="/profile" onClick={onClose}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 hover:bg-[#f0f4f8]"
          style={{ color: "#1a2332" }}>
          <Pencil className="h-4 w-4" style={{ color: "#1F7A63" }} />
          Edit Profile
        </Link>
        <button onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 hover:bg-[rgba(214,69,69,0.06)]"
          style={{ color: "#D64545" }}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────
export function AppHeader() {
  const { user } = useUser()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)

  const { notifications, markAsRead, dismiss, addNotification } = useNotifications()

  // Derive the display mode directly from the user's role
  const activeMode = user?.role || "farmer"

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Simulate notifications for demo
  useEffect(() => {
    if (user && notifications.length === 0) {
      addNotification({
        type: "info",
        title: "Welcome to GRODE Climate Intel",
        message: "Get started by exploring the dashboard and setting up your preferences.",
      })
      addNotification({
        type: "warning",
        title: "False-Onset Risk Alert",
        message: "High risk detected in your district. Check the dashboard for details.",
        action: { label: "View Details", href: "/false-onset" },
      })
    }
  }, [user, addNotification, notifications.length])

  const unreadCount = notifications.filter(n => !n.read).length

  const initials = user ? getInitials(user) : null

  return (
    <header className="flex h-16 items-center justify-between border-b border-[#e2e8f0] bg-white px-3 sm:px-4 md:px-8 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-10">
        <MobileSidebar />
        <span className="text-[15px] sm:text-[17px] font-bold tracking-tight hidden sm:block" style={{ color: "#0F2A3D" }}>
          GRODE-Climate Intelligent System
        </span>
        {/* Role indicator (Hidden on mobile & tablet, visible on desktop and up) */}
        <nav className="hidden lg:flex items-center gap-3 rounded-full bg-[#f0f4f8] p-1.5 px-2">
          {(["farmer", "expert"] as const).map((mode) => (
            <div
              key={mode}
              className={cn(
                "rounded-full px-5 py-1.5 text-[13px] font-semibold transition-all duration-200 capitalize select-none",
                activeMode === mode ? "bg-white text-[#0F2A3D] shadow-sm" : "text-[#6b7a8d]"
              )}
            >
              {mode === "farmer" ? "Farmer" : "Expert"}
            </div>
          ))}
        </nav>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
        {/* Notifications - Always visible */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setNotificationsOpen((o) => !o)}
            className="relative flex items-center justify-center w-8 sm:w-9 h-8 sm:h-9 rounded-full border border-[#e2e8f0] bg-white transition-all duration-200 hover:bg-[#f0f4f8] hover:border-[#0F2A3D]/20"
            title="Notifications"
          >
            <Bell className="h-3.5 sm:h-4 w-3.5 sm:w-4" style={{ color: "#6b7a8d" }} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#D64545] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-full mt-2 z-50">
              <NotificationsPanel
                notifications={notifications}
                onMarkAsRead={markAsRead}
                onDismiss={dismiss}
              />
            </div>
          )}
        </div>

        {/* Location - Visible on tablet and up with text */}
        {user ? (
          <button className="hidden sm:flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-2.5 md:px-3.5 py-1.5 sm:py-2 text-[12px] sm:text-[13px] font-medium text-[#1a2332] transition-all duration-200 hover:bg-[#f0f4f8] hover:shadow-sm">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-[#1F7A63]" />
            <span className="hidden md:inline">
              {(() => {
                const map: Record<string, string> = {
                  "lilongwe": "Lilongwe", "blantyre": "Blantyre", "mzimba": "Mzimba",
                  "zomba": "Zomba", "dedza": "Dedza", "mchinji": "Mchinji",
                  "salima": "Salima", "nkhotakota": "Nkhotakota", "kasungu": "Kasungu",
                }
                return map[user.district] ?? user.district
              })()}
            </span>
          </button>
        ) : null}

        {/* Profile / Avatar button - Always visible but compact on mobile */}
        <div className="relative" ref={dropdownRef}>
          {user ? (
            <button
              id="profile-avatar-btn"
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-1 sm:gap-2 rounded-full border border-[#e2e8f0] bg-white pl-1 pr-1 sm:pr-2 md:pr-3 py-1 transition-all duration-200 hover:border-[#0F2A3D]/30 hover:shadow-sm"
            >
              <InitialsAvatar initials={initials!} size={28} />
              <span className="hidden md:inline-block text-[12px] sm:text-[12.5px] font-semibold max-w-[80px] truncate" style={{ color: "#1a2332" }}>
                {user.firstName}
              </span>
              <ChevronDown className={cn("hidden md:block h-3.5 w-3.5 transition-transform duration-200", dropdownOpen && "rotate-180")}
                style={{ color: "#6b7a8d" }} />
            </button>
          ) : (
            <Link
              href="/create-account"
              title="Create account"
              className="flex h-8 sm:h-9 w-8 sm:w-9 items-center justify-center rounded-full border border-[#e2e8f0] bg-white transition-all duration-200 hover:bg-[#f0f4f8] hover:border-[#0F2A3D]/20"
            >
              <User className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-[#6b7a8d]" />
            </Link>
          )}

          {dropdownOpen && user && (
            <ProfileDropdown onClose={() => setDropdownOpen(false)} />
          )}
        </div>
      </div>
    </header>
  )
}
