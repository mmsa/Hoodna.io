import { brand } from "@hoodna/tokens"
import { cn } from "@/lib/utils"

type BrandWordmarkProps = {
  variant?: "header" | "sidebar" | "compact"
  className?: string
}

export function BrandWordmark({ variant = "header", className }: BrandWordmarkProps) {
  if (variant === "compact") {
    return (
      <div className={cn("brand-lock flex min-w-0 flex-col leading-tight", className)}>
        <span className="text-base font-semibold text-foreground">
          {brand.nameLatin}
          {brand.domain}
        </span>
        <span className="font-arabic text-xs font-medium text-muted-foreground" lang="ar">
          {brand.nameArabic}
        </span>
      </div>
    )
  }

  if (variant === "sidebar") {
    return (
      <div className={cn("brand-lock min-w-0 leading-tight", className)}>
        <p className="text-base font-bold">{brand.nameLatinTitle}</p>
        <p className="font-arabic text-[11px] font-semibold text-white/85" lang="ar">
          {brand.nameArabic}
        </p>
      </div>
    )
  }

  return (
    <div className={cn("brand-lock hidden min-w-0 flex-col leading-tight sm:flex", className)}>
      <span className="text-lg font-bold tracking-tight text-primary">{brand.nameLatin}</span>
      <span className="font-arabic text-xs font-semibold text-primary/80" lang="ar">
        {brand.nameArabic}
      </span>
    </div>
  )
}
