import { brand } from "@hoodna/tokens"
import { cn } from "@/lib/utils"

type BrandWordmarkProps = {
  variant?: "header" | "sidebar" | "compact"
  className?: string
}

export function BrandWordmark({ variant = "header", className }: BrandWordmarkProps) {
  if (variant === "compact") {
    return (
      <div className={cn("flex flex-col leading-tight", className)}>
        <span className="text-base font-semibold text-foreground">
          {brand.nameLatin}
          {brand.domain}
        </span>
        <span className="font-arabic text-xs font-medium text-muted-foreground" dir="rtl" lang="ar">
          {brand.nameArabic}
        </span>
      </div>
    )
  }

  if (variant === "sidebar") {
    return (
      <div className={cn("leading-tight", className)}>
        <p className="text-base font-bold">{brand.nameLatinTitle}</p>
        <p className="font-arabic text-[11px] font-semibold text-white/85" dir="rtl" lang="ar">
          {brand.nameArabic}
        </p>
      </div>
    )
  }

  return (
    <div className={cn("hidden flex-col leading-tight sm:flex", className)}>
      <span className="text-lg font-bold tracking-tight text-primary">{brand.nameLatin}</span>
      <span className="font-arabic text-xs font-semibold text-primary/80" dir="rtl" lang="ar">
        {brand.nameArabic}
      </span>
    </div>
  )
}
