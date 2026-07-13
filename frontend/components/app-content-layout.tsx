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
    return <>{children}</>
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] gap-6 px-4 sm:px-6">
      <aside className="hidden w-52 shrink-0 xl:block">
        <DesktopNavSidebar />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
