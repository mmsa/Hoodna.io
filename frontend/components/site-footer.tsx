import Link from "next/link"

import { ELJIRAN_SUPPORT_EMAIL } from "@hoodna/shared"
import { cn } from "@/lib/utils"

const links = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/support", label: "Support" },
  { href: "/delete-account", label: "Delete account" },
]

export function SiteFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear()

  return (
    <footer className={cn("w-full", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          © {year} eljiran. All rights reserved.
        </p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <a
            href={`mailto:${ELJIRAN_SUPPORT_EMAIL}`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {ELJIRAN_SUPPORT_EMAIL}
          </a>
        </nav>
      </div>
    </footer>
  )
}
