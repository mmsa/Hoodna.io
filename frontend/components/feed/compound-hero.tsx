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
      <div className="relative aspect-[21/9] min-h-[160px] w-full bg-primary/10 sm:min-h-[200px]">
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
            className="object-cover opacity-20"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/85 via-primary/60 to-primary/25" />
        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6">
          <CompoundChip
            name={compoundName}
            area={compoundArea}
            className="mb-3 w-fit border-white/30 bg-white/20 text-white [&_svg]:text-white"
          />
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/90 sm:text-base">
            Your neighbourhood feed — updates, help requests, and community news from verified neighbours.
          </p>
          <div className="mt-4">
            <Button asChild variant="accent" size="sm">
              <Link href="/marketplace">Browse marketplace</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
