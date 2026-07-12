"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings, User } from "lucide-react"

import { AppShell, PageHeader, PageLayout } from "@/components/ui/page-layout"
import { cn } from "@/lib/utils"

const accountLinks = [
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
]

interface AccountShellProps {
  title: string
  description: string
  children: React.ReactNode
}

export function AccountShell({
  title,
  description,
  children,
}: AccountShellProps) {
  const pathname = usePathname()

  return (
    <AppShell>
      <PageLayout width="md" className="space-y-8">
        <PageHeader
          eyebrow="Account"
          title={title}
          description={description}
        />
        <nav
          aria-label="Account sections"
          className="flex gap-1 border-b border-border"
        >
          {accountLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </nav>
        {children}
      </PageLayout>
    </AppShell>
  )
}
