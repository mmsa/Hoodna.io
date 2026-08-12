import Link from "next/link"
import type { ReactNode } from "react"

import { SiteFooter } from "@/components/site-footer"

export function LegalPage({
  title,
  description,
  updated,
  children,
}: {
  title: string
  description: string
  updated: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-3xl py-10 sm:py-14">
      <div className="mb-8">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          ← Back to eljiran
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">{description}</p>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      </div>

      <article className="space-y-8 text-[15px] leading-7 text-foreground/90 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:ps-5 [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline">
        {children}
      </article>

      <SiteFooter className="mt-14 border-t border-border pt-8" />
    </div>
  )
}
