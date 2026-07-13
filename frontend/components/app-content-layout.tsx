"use client"

import { usePathname } from "next/navigation"

import { DesktopNavSidebar } from "@/components/desktop-nav-sidebar"

const HIDDEN_PREFIXES = ["/auth"]

function shouldShowSidebar(pathname: string | null) {
  if (!pathname) return false
  return !HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function AppContentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (!shouldShowSidebar(pathname)) {
    return <div className="eljiran-shell px-4 sm:px-6">{children}</div>
  }

  return (
    <div className="eljiran-shell flex gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <aside className="hidden w-56 shrink-0 xl:block">
        <DesktopNavSidebar />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
