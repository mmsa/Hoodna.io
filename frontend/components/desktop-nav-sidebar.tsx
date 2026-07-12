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
  { href: "/feed", label: "Home", icon: Home },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/services", label: "Services", icon: Wrench },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function DesktopNavSidebar() {
  const pathname = usePathname()

  return (
    <nav aria-label="Main navigation" className="sticky top-24 space-y-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/feed" && pathname?.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-[16px] px-4 py-3 text-sm font-semibold transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-card"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
