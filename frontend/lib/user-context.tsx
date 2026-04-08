"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { z } from "zod"

export interface UserLocation {
  lat: number | null
  lng: number | null
  label: string
}

export interface UserNotifications {
  riskAlerts: boolean
  weeklyReport: boolean
  onsetAlerts: boolean
  systemUpdates: boolean
}

export interface UserProfile {
  email: string
  firstName: string
  lastName: string
  phone: string
  role: "farmer" | "expert"
  district: string
  crops: string[]
  location: UserLocation | null
  notifications: UserNotifications
  createdAt: string
}

// Zod schema for validation
const userLocationSchema = z.object({
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  label: z.string(),
})

const userNotificationsSchema = z.object({
  riskAlerts: z.boolean(),
  weeklyReport: z.boolean(),
  onsetAlerts: z.boolean(),
  systemUpdates: z.boolean(),
})

const userProfileSchema = z.object({
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  role: z.enum(["farmer", "expert"]),
  district: z.string(),
  crops: z.array(z.string()),
  location: userLocationSchema.nullable(),
  notifications: userNotificationsSchema,
  createdAt: z.string(),
})

interface UserContextType {
  user: UserProfile | null
  isHydrated: boolean
  login: (profile: UserProfile) => void
  logout: () => void
  updateProfile: (updates: Partial<UserProfile>) => void
}

const UserContext = createContext<UserContextType>({
  user: null,
  isHydrated: false,
  login: () => {},
  logout: () => {},
  updateProfile: () => {},
})

const STORAGE_KEY = "esri_user_v1"

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        // Validate with Zod schema
        const validUser = userProfileSchema.parse(parsed)
        setUser(validUser)
      }
    } catch (error) {
      // If stored data is invalid, clear it
      console.error("Stored user data is invalid or corrupted:", error)
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {}
    }
    setIsHydrated(true)
  }, [])

  const persist = (profile: UserProfile | null) => {
    try {
      if (profile) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  const login = (profile: UserProfile) => {
    setUser(profile)
    persist(profile)
  }

  const logout = () => {
    setUser(null)
    persist(null)
  }

  const updateProfile = (updates: Partial<UserProfile>) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...updates }
      persist(next)
      return next
    })
  }

  return (
    <UserContext.Provider value={{ user, isHydrated, login, logout, updateProfile }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)

/** Compute 1-2 letter initials from a user profile */
export function getInitials(user: UserProfile): string {
  const f = user.firstName?.[0] ?? ""
  const l = user.lastName?.[0] ?? ""
  return (f + l).toUpperCase()
}

/** Request browser notification permission and optionally fire a welcome notification */
export async function requestBrowserNotifications(districtLabel: string): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false
  const perm = await Notification.requestPermission()
  if (perm === "granted") {
    new Notification("ESRI Malawi — Alerts Enabled", {
      body: `You will now receive climate alerts for ${districtLabel} District.`,
      icon: "/icon.svg",
    })
    return true
  }
  return false
}
