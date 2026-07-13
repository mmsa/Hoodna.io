"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  Bookmark,
  Home,
  MessageCircle,
  Settings,
  ShoppingBag,
  Wrench,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"

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
      pathname.startsWith("/profile"),
  },
]

export function DesktopNavSidebar() {
  const pathname = usePathname() ?? ""
  const { user } = useAuth()

  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-[5.5rem] flex min-h-[calc(100vh-7.5rem)] flex-col overflow-hidden rounded-[18px] bg-[#07534f] p-3 text-white shadow-[0_10px_30px_rgba(7,83,79,0.18)]"
    >
      <Link href="/feed" className="mb-4 flex items-center gap-3 rounded-xl px-2 py-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12">
          <Home className="h-5 w-5" />
        </span>
        <div>
          <p className="text-base font-bold">Eljiran</p>
          <p className="text-[10px] text-white/60">Your neighbourhood</p>
        </div>
      </Link>

      <div className="space-y-1">
        {links.map(({ href, label, icon: Icon, isActive }) => {
          const active = isActive(pathname)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150",
                active
                  ? "bg-white/16 text-white shadow-sm"
                  : "text-white/72 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </div>

      <div className="my-4 h-px bg-white/10" />

      <div className="space-y-1">
        {[
          { href: "/messages", label: "Messages", icon: MessageCircle },
          { href: "/notifications", label: "Notifications", icon: Bell },
          { href: "/saved-listings", label: "Saved", icon: Bookmark },
        ].map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-white/16 text-white" : "text-white/68 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </Link>
          )
        })}
      </div>

      {user ? (
        <Link
          href="/profile"
          className="mt-auto flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 p-2.5 transition-colors hover:bg-white/10"
        >
          <Avatar
            name={user.name}
            src={user.avatar_url}
            size="sm"
            className="border-white/20 bg-white/15 text-white"
          />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{user.name}</p>
            <p className="text-[10px] text-white/55">View profile</p>
          </div>
        </Link>
      ) : null}
    </nav>
  )
}
