"use client"

import { Loader2 } from "lucide-react"

interface LoadingProps {
  size?: "sm" | "md" | "lg"
  text?: string
}

export function Loading({ size = "md", text }: LoadingProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <Loader2 className={`${sizeClasses[size]} animate-spin`} style={{ color: "#1F7A63" }} />
      {text && <p className="text-sm text-[#6b7a8d]">{text}</p>}
    </div>
  )
}