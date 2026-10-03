import { ELJIRAN_APP_STORE_URL, ELJIRAN_PLAY_STORE_URL } from "@hoodna/shared"

import { useTranslation } from "@/components/locale-provider"
import { cn } from "@/lib/utils"

export function StoreBadges({
  className,
  align = "start",
}: {
  className?: string
  align?: "start" | "center"
}) {
  const { t, locale } = useTranslation()
  const lang = locale === "ar" ? "ar" : "en"

  return (
    <div className={cn(align === "center" && "text-center", className)}>
      <p className="mb-2 text-sm font-medium text-white/80">{t("landing.getTheApp")}</p>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          align === "center" && "justify-center",
        )}
      >
        <a
          href={ELJIRAN_APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("landing.downloadAppStore")}
          className="inline-flex rounded-md transition-opacity hover:opacity-90"
        >
          <img
            src={`/badges/app-store-${lang}.svg`}
            alt={t("landing.downloadAppStore")}
            className="h-10 w-auto"
          />
        </a>
        <a
          href={ELJIRAN_PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("landing.downloadPlayStore")}
          className="inline-flex rounded-md transition-opacity hover:opacity-90"
        >
          <img
            src={`/badges/play-${lang}.png`}
            alt={t("landing.downloadPlayStore")}
            className="-my-2 h-[60px] w-auto"
          />
        </a>
      </div>
    </div>
  )
}
