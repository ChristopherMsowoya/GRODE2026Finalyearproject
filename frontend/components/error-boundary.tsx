"use client"

import React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />
    }

    return this.props.children
  }
}

function DefaultErrorFallback({ error, resetError }: { error?: Error; resetError: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="text-center space-y-4">
        <AlertTriangle className="h-12 w-12 mx-auto" style={{ color: "#D64545" }} />
        <h2 className="text-xl font-bold" style={{ color: "#0F2A3D" }}>
          Something went wrong
        </h2>
        <p className="text-[#6b7a8d] max-w-md">
          We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
        </p>
        {error && (
          <details className="text-left bg-[#f8fafc] p-4 rounded-lg text-sm">
            <summary className="cursor-pointer font-medium">Error details</summary>
            <pre className="mt-2 text-xs overflow-auto">{error.message}</pre>
          </details>
        )}
        <button
          onClick={resetError}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ background: "#1F7A63", color: "#fff" }}
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  )
}

export { ErrorBoundary, DefaultErrorFallback }