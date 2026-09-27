"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import { BrandLockup } from "@/components/brand-lockup"
import { useTranslation } from "@/components/locale-provider"

const SCENES = {
  arrive: {
    src: "/marketing/compound-gate.jpg",
    alt: "landing.altGate",
    title: "landing.sceneArriveTitle",
    body: "landing.sceneArriveBody",
    frame: "origin-bottom scale-[1.7]",
  },
  join: {
    src: "/marketing/neighbours-welcome.jpg",
    alt: "landing.altWelcome",
    title: "landing.sceneJoinTitle",
    body: "landing.sceneJoinBody",
    frame: "object-center",
  },
} as const

export function AuthStage({
  title,
  subtitle,
  scene,
  children,
}: {
  title: string
  subtitle: string
  scene: keyof typeof SCENES
  children: ReactNode
}) {
  const { t } = useTranslation()
  const visual = SCENES[scene]

  return (
    <div className="eljiran-bleed">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <aside className="relative hidden min-h-screen overflow-hidden lg:block">
          <Image
            src={visual.src}
            alt={t(visual.alt)}
            fill
            priority
            sizes="55vw"
            className={`object-cover ${visual.frame}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/35" />
          <div className="relative flex h-full min-h-screen flex-col justify-between p-10 text-white">
            <BrandLockup size="md" tone="inverse" />
            <div className="max-w-md">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/75">
                {t("landing.eyebrow")}
              </p>
              <h2 className="text-4xl font-bold leading-tight">{t(visual.title)}</h2>
              <p className="mt-4 text-lg text-white/85">{t(visual.body)}</p>
            </div>
          </div>
        </aside>
        <div className="flex min-h-screen flex-col bg-background">
          <div className="relative h-52 overflow-hidden lg:hidden">
            <Image
              src={visual.src}
              alt={t(visual.alt)}
              fill
              priority
              sizes="100vw"
              className={`object-cover ${visual.frame}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/25" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <BrandLockup size="sm" tone="inverse" />
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
            <div className="w-full max-w-md">
              <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_16px_40px_rgba(21,128,116,0.08)] sm:p-8">
                <h1 className="mb-1 text-2xl font-bold text-foreground">{title}</h1>
                <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
