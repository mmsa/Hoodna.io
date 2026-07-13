import Link from "next/link"
import Image from "next/image"
import { ShieldCheck, Sparkles, Users } from "lucide-react"

import { SignedFileImage } from "@/components/signed-file"
import { Button } from "@/components/ui/button"
import { formatCompoundWithArea } from "@/lib/format-compound"

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
  const title = formatCompoundWithArea(compoundName, compoundArea)
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
      label: "This week",
      value: `${recentPostsCount + recentListingsCount} updates`,
    },
  ]

  return (
    <section className="eljiran-card mb-5 overflow-hidden border-border/70 bg-card">
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)] lg:items-center">
        <div className="flex min-w-0 gap-4">
          <div className="relative hidden h-28 w-44 shrink-0 overflow-hidden rounded-[18px] bg-primary/10 sm:block">
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
            <div className="eljiran-hero-pattern absolute inset-0 bg-gradient-to-br from-primary/70 via-primary/40 to-transparent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified compound
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              A trusted neighbourhood feed for questions, updates, offers, and
              local decisions that matter day to day.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button asChild size="sm">
                <Link href="/feed#composer">Start a post</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/marketplace">Browse marketplace</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[18px] border border-border/70 bg-background/70 p-3.5"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                {stat.icon}
              </div>
              <p className="text-lg font-semibold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
