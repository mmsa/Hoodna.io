"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Settings,
  ShoppingBag,
  Wrench,
} from "lucide-react"

import { cn } from "@/lib/utils"

const links = [
  {
    href: "/feed",
    label: "Home",
    icon: Home,
    isActive: (pathname: string) =>
      pathname === "/feed" || pathname === "/notifications",
  },
  {
    href: "/marketplace",
    label: "Marketplace",
    icon: ShoppingBag,
    isActive: (pathname: string) =>
      pathname.startsWith("/marketplace") ||
      pathname.startsWith("/listing") ||
      pathname.startsWith("/saved-listings") ||
      pathname.startsWith("/saved") ||
      pathname.startsWith("/promote"),
  },
  {
    href: "/services",
    label: "Services",
    icon: Wrench,
    isActive: (pathname: string) =>
      pathname.startsWith("/services") || pathname.startsWith("/businesses"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    isActive: (pathname: string) =>
      pathname.startsWith("/settings") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/messages"),
  },
]

export function DesktopNavSidebar() {
  const pathname = usePathname() ?? ""

  return (
    <nav aria-label="Main navigation" className="eljiran-nav-panel sticky top-[5.5rem]">
      <div className="space-y-0.5">
        {links.map(({ href, label, icon: Icon, isActive }) => {
          const active = isActive(pathname)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[15px] font-semibold transition-all duration-150",
                active
                  ? "bg-primary text-primary-foreground shadow-card"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
