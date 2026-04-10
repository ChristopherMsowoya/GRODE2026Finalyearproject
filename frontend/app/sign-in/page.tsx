"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Mail, Lock, Eye, EyeOff, ChevronRight, Loader2 } from "lucide-react"
import { useUser } from "@/lib/user-context"
import type { UserProfile } from "@/lib/user-context"

// ─── Shared field component ──────────────────────────────────────────────────
function InputField({
  id, label, type = "text", placeholder, icon: Icon, value, onChange, suffix,
}: {
  id: string; label: string; type?: string; placeholder: string;
  icon: React.ElementType; value: string; onChange: (v: string) => void;
  suffix?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold" style={{ color: "#1a2332" }}>
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: focused ? "#1F7A63" : "#6b7a8d" }} />
        <input
          id={id} type={type} placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full bg-white outline-none transition-all duration-200"
          style={{
            border: `1.5px solid ${focused ? "#1F7A63" : "#e2e8f0"}`,
            color: "#1a2332",
            borderRadius: "12px",
            padding: "12px 16px 12px 40px",
            fontSize: "13.5px"
          }}
        />
        {suffix && <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useUser()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    setError("")

    // Simulate network delay
    setTimeout(() => {
      // For demo purposes, accept any email/password combination
      // In a real application, this would verify credentials against a database
      if (email && password) {
        // Create a demo profile if they haven't explicitly created one.
        // In a real application, this would fetch from a database.
        const mockProfile: UserProfile = {
          email: email,
          firstName: "Demo",
          lastName: "User",
          phone: "+265 990 123 456",
          role: "farmer",
          district: "lilongwe",
          crops: ["Maize", "Groundnuts"],
          location: null,
          notifications: {
            riskAlerts: true,
            weeklyReport: true,
            onsetAlerts: true,
            systemUpdates: false,
          },
          createdAt: new Date().toISOString(),
        }

        login(mockProfile)
        
        // Redirect to the page user was trying to access, or dashboard
        const redirect = searchParams.get("redirect")
        router.push(redirect || "/")
      } else {
        setError("Invalid email or password. Please try again.")
      }
      setLoading(false)
    }, 1200)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f4f6f8", fontFamily: "Inter, sans-serif" }}>

      {/* ── Form panel ──────────────────────────────────────────────────────── */}
      <div className="w-full max-w-[440px] rounded-3xl bg-white p-8 lg:p-10 mx-6"
        style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.1)" }}>

          <div className="mb-8">
            <h2 className="text-[28px] font-extrabold tracking-tight" style={{ color: "#0F2A3D" }}>Sign In</h2>
            <p className="mt-1 text-[13.5px]" style={{ color: "#6b7a8d" }}>Enter your credentials to access your account.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSignIn}>
            <InputField
              id="email"
              label="Email address"
              type="email"
              placeholder="you@example.com"
              icon={Mail}
              value={email}
              onChange={setEmail}
            />

            <InputField
              id="password"
              label="Password"
              type={showPw ? "text" : "password"}
              placeholder="Enter your password"
              icon={Lock}
              value={password}
              onChange={setPassword}
              suffix={
                <button type="button" onClick={() => setShowPw((p) => !p)}
                  className="text-[#6b7a8d] hover:text-[#0F2A3D] transition-colors">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <div className="flex justify-end">
              <Link href="#" className="text-[12px] font-semibold transition-colors hover:underline" style={{ color: "#1F7A63" }}>
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={!email || !password || loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#0F2A3D 0%,#1F7A63 100%)" }}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
              ) : (
                <>Sign In <ChevronRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[13.5px]" style={{ color: "#6b7a8d" }}>
            Don&apos;t have an account?{" "}
            <Link href="/create-account" className="font-semibold hover:underline" style={{ color: "#1F7A63" }}>
              Create an account
            </Link>
          </p>
        </div>
    </div>
  )
}
