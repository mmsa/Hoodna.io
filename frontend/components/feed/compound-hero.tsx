import Link from "next/link"
import Image from "next/image"

import { SignedFileImage } from "@/components/signed-file"
import { Button } from "@/components/ui/button"
import { CompoundChip } from "@/components/compound-chip"
import { formatCompoundWithArea } from "@/lib/format-compound"

interface CompoundHeroProps {
  compoundName: string
  compoundArea?: string | null
  heroImageUrl?: string | null
}

export function CompoundHero({
  compoundName,
  compoundArea,
  heroImageUrl,
}: CompoundHeroProps) {
  const title = formatCompoundWithArea(compoundName, compoundArea)

  return (
    <section className="eljiran-card relative mb-6 overflow-hidden">
      <div className="relative aspect-[2.4/1] min-h-[180px] w-full bg-primary sm:min-h-[220px]">
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
            className="object-cover opacity-15 mix-blend-overlay"
            priority
          />
        )}
        <div className="eljiran-hero-pattern absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/75" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-7">
          <CompoundChip
            name={compoundName}
            area={compoundArea}
            className="mb-3 w-fit border-white/25 bg-white/15 text-white backdrop-blur-sm [&_svg]:text-white"
          />
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-white sm:text-[2rem]">
            {title}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/85 sm:text-[15px]">
            Community updates, help requests, and news from verified neighbours.
          </p>
          <div className="mt-5">
            <Button asChild variant="accent" size="sm" className="shadow-card">
              <Link href="/marketplace">Browse marketplace</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
