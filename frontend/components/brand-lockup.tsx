import Image from "next/image"
import Link from "next/link"
import { brand } from "@hoodna/tokens"
import { cn } from "@/lib/utils"

type BrandLockupProps = {
  size?: "sm" | "md" | "lg"
  tone?: "default" | "inverse"
  className?: string
}

const dimensions = { sm: 36, md: 48, lg: 76 } as const

export function BrandLockup({ size = "md", tone = "default", className }: BrandLockupProps) {
  const dimension = dimensions[size]
  const inverse = tone === "inverse"

  return (
    <Link
      href="/"
      className={cn("brand-lock inline-flex min-w-0 items-center gap-3", className)}
    >
      <Image
        src="/icon_light.jpg"
        alt=""
        width={dimension}
        height={dimension}
        priority
        className={cn(
          "shrink-0 bg-white object-cover shadow-sm",
          size === "lg" ? "rounded-[22px]" : "rounded-2xl",
          inverse && "ring-2 ring-white/70"
        )}
      />
      <span className="min-w-0">
        <span
          className={cn(
            "block font-bold tracking-tight",
            size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-base",
            inverse ? "text-white" : "text-primary"
          )}
        >
          {brand.nameLatin}
          <span className={inverse ? "text-white/70" : "text-primary/70"}>{brand.domain}</span>
        </span>
        <span
          className={cn(
            "font-arabic block font-semibold",
            size === "lg" ? "text-lg" : "text-sm",
            inverse ? "text-white/85" : "text-primary/80"
          )}
          lang="ar"
        >
          {brand.nameArabic}
        </span>
      </span>
    </Link>
  )
}
