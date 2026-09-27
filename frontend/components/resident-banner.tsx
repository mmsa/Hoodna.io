import Image from "next/image"
import type { ReactNode } from "react"

export function ResidentBanner({
  src,
  alt,
  eyebrow,
  title,
  description,
  actions,
}: {
  src: string
  alt: string
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px]">
      <Image src={src} alt={alt} fill sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-[#10211e]/68" />
      <div className="relative flex min-h-[200px] flex-col justify-end gap-4 p-6 text-start text-white sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-white/85 sm:text-base">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}
