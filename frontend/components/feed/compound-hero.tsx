import Link from "next/link"
import Image from "next/image"
import { ShieldCheck, Sparkles, Users } from "lucide-react"

import { SignedFileImage } from "@/components/signed-file"
import { Button } from "@/components/ui/button"
import { formatCompoundName } from "@/lib/format-compound"

interface CompoundHeroProps {
  compoundName: string
  compoundArea?: string | null
  heroImageUrl?: string | null
  totalNeighbors?: number
  recentPostsCount?: number
  recentListingsCount?: number
}

export function CompoundHero({
  compoundName,
  compoundArea,
  heroImageUrl,
  totalNeighbors = 0,
  recentPostsCount = 0,
  recentListingsCount = 0,
}: CompoundHeroProps) {
  const stats = [
    {
      icon: <Users className="h-4 w-4 text-primary" />,
      label: "Neighbours",
      value: totalNeighbors.toLocaleString(),
    },
    {
      icon: <ShieldCheck className="h-4 w-4 text-primary" />,
      label: "Verified compound",
      value: "Trusted",
    },
    {
      icon: <Sparkles className="h-4 w-4 text-primary" />,
      label: "Recent activity",
      value: `${recentPostsCount + recentListingsCount} updates`,
    },
  ]

  return (
    <section className="eljiran-card mb-5 overflow-hidden border-border/70 bg-card p-3 sm:p-4">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-[14px] bg-primary/10 sm:h-28 sm:w-40">
            {heroImageUrl ? (
              <SignedFileImage
                fileUrl={heroImageUrl}
                alt={`${compoundName} neighbourhood`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <Image
                src="/icon_light.jpg"
                alt=""
                fill
                className="object-cover opacity-25"
                priority
              />
            )}
            <div className="absolute inset-0 ring-1 ring-inset ring-black/5" />
          </div>

          <div className="min-w-0 flex-1 py-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified compound
            </div>
            <h1 className="mt-2 line-clamp-2 text-xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-2xl">
              {formatCompoundName(compoundName)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {compoundArea || "Your verified neighbourhood"}
            </p>
            <div className="mt-3 hidden flex-wrap items-center gap-2 sm:flex">
              <Button asChild size="sm" className="h-8 px-3 text-xs">
                <Link href="/feed#composer">Start a post</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-8 px-3 text-xs">
                <Link href="/marketplace">Browse market</Link>
              </Button>
            </div>
          </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex min-w-0 items-center gap-2 rounded-[12px] border border-border/60 bg-background/70 px-2.5 py-2.5 sm:px-3"
            >
              <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 sm:flex">
                {stat.icon}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground sm:text-base">{stat.value}</p>
                <p className="truncate text-[9px] text-muted-foreground sm:text-[10px]">{stat.label}</p>
              </div>
            </div>
          ))}
      </div>
    </section>
  )
}
