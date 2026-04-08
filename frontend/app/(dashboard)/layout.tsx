import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { ErrorBoundary } from "@/components/error-boundary"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden bg-[#F5F7FA]">
        {/* Sidebar - Hidden on mobile, shown on md breakpoint */}
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-y-auto bg-[#F5F7FA] p-3 sm:p-4 md:p-7">
            {children}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  )
}
