"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Bell, Car, Siren } from "lucide-react"
import { useTranslation } from "@/components/locale-provider"
import { cn } from "@/lib/utils"

const ROWS = [
  {
    label: "landing.boardMarket",
    body: "landing.boardMarketBody",
    icon: Car,
    tone: "bg-emerald-100 text-emerald-800",
  },
  {
    label: "landing.boardUrgent",
    body: "landing.boardUrgentBody",
    icon: Siren,
    tone: "bg-amber-100 text-amber-800",
  },
  {
    label: "landing.boardProblem",
    body: "landing.boardProblemBody",
    icon: AlertTriangle,
    tone: "bg-orange-100 text-orange-800",
  },
  {
    label: "landing.boardNeighbour",
    body: "landing.boardNeighbourBody",
    icon: Bell,
    tone: "bg-primary/10 text-primary",
  },
] as const

export function CompoundThread() {
  const { t } = useTranslation()
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % ROWS.length)
    }, 2400)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="rounded-[28px] border border-white/70 bg-[#F7F4EC]/95 p-4 shadow-[0_24px_60px_rgba(16,33,30,0.28)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{t("landing.previewLabel")}</p>
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
          <span className="relative flex h-2 w-2">
            <span className="eljiran-ping absolute inline-flex h-full w-full rounded-full bg-primary" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          {t("landing.previewLive")}
        </span>
      </div>
      <div className="space-y-2">
        {ROWS.map((row, index) => {
          const Icon = row.icon
          return (
            <div
              key={row.label}
              className={cn(
                "flex items-start gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm transition",
                index === active && "ring-2 ring-primary/30"
              )}
            >
              <span className={cn("mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", row.tone)}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(row.label)}
                </p>
                <p className="text-sm leading-snug text-foreground">{t(row.body)}</p>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">{t("landing.threadNote")}</p>
    </div>
  )
}
