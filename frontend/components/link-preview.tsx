'use client'

import { useEffect, useState } from 'react'
import {
  classifyLinkHost,
  displayHostname,
  extractUrls,
  firstHttpUrl,
  isUrlOnlyContent,
  linkKindLabel,
  socialBrandTheme,
  socialWatchLabel,
  youtubeThumbnailUrl,
  type LinkHostKind,
  type LinkPreviewData,
} from '@hoodna/shared'
import { ArrowUpRight, ExternalLink, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

function linkifyText(text: string) {
  const urls = extractUrls(text)
  if (urls.length === 0) return text

  const parts: Array<string | { url: string }> = []
  let remaining = text
  for (const url of urls) {
    const idx = remaining.indexOf(url)
    if (idx === -1) continue
    if (idx > 0) parts.push(remaining.slice(0, idx))
    parts.push({ url })
    remaining = remaining.slice(idx + url.length)
  }
  if (remaining) parts.push(remaining)

  return parts.map((part, i) =>
    typeof part === 'string' ? (
      <span key={i}>{part}</span>
    ) : (
      <a
        key={i}
        href={part.url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-primary underline-offset-2 hover:underline"
      >
        {part.url}
      </a>
    )
  )
}

export function LinkifiedText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  if (isUrlOnlyContent(text)) return null
  return <p className={cn('whitespace-pre-wrap break-words', className)}>{linkifyText(text)}</p>
}

function SocialMark({ kind, className }: { kind: LinkHostKind; className?: string }) {
  if (kind === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" className={cn('fill-white', className)} aria-hidden>
        <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05v-2.66c0-3.02 1.8-4.7 4.56-4.7 1.32 0 2.7.24 2.7.24v2.97h-1.52c-1.5 0-1.97.93-1.97 1.89v2.26h3.35l-.54 3.49h-2.81V24C19.61 23.1 24 18.1 24 12.07z" />
      </svg>
    )
  }
  if (kind === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" className={cn('fill-white', className)} aria-hidden>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .56.04.83.1v-3.5a6.37 6.37 0 0 0-.83-.05A6.34 6.34 0 0 0 3.16 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.72a8.23 8.23 0 0 0 4.81 1.54V6.8a4.84 4.84 0 0 1-1.06-.11z" />
      </svg>
    )
  }
  if (kind === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className={cn('fill-white', className)} aria-hidden>
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zm0-2.16C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95C23.73 2.69 21.31.27 16.95.07 15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z" />
      </svg>
    )
  }
  if (kind === 'twitter') {
    return (
      <svg viewBox="0 0 24 24" className={cn('fill-white', className)} aria-hidden>
        <path d="M18.244 2H21.5l-7.5 8.57L22.5 22h-6.59l-5.16-6.74L5.2 22H1.94l8.03-9.17L1.5 2h6.75l4.66 6.16L18.244 2zm-1.16 18h1.83L7.08 3.94H5.12L17.084 20z" />
      </svg>
    )
  }
  return <ExternalLink className={cn('text-white', className)} />
}

/** Compact chip when we have no real thumbnail — no giant empty media block. */
function CompactSocialLink({
  url,
  kind,
  className,
}: {
  url: string
  kind: LinkHostKind
  className?: string
}) {
  const theme = socialBrandTheme(kind)
  const host = displayHostname(url)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'mt-3 flex items-center gap-3 rounded-2xl border border-border/80 bg-card px-3 py-2.5 shadow-sm transition hover:border-border hover:shadow-md',
        className
      )}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-inner"
        style={{ background: `linear-gradient(145deg, ${theme.bg}, ${theme.bgEnd})` }}
      >
        <SocialMark kind={kind} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {linkKindLabel(kind)}
        </span>
        <span className="block truncate text-sm font-semibold text-foreground">
          {socialWatchLabel(kind)}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{host}</span>
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <ArrowUpRight className="h-4 w-4" />
      </span>
    </a>
  )
}

export function LinkPreviewCard({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const url = firstHttpUrl(text)
  const [preview, setPreview] = useState<LinkPreviewData | null>(null)

  useEffect(() => {
    if (!url) {
      setPreview(null)
      return
    }
    const kind = classifyLinkHost(url)
    const local: LinkPreviewData = {
      url,
      kind,
      title: socialWatchLabel(kind),
      description: displayHostname(url),
      site_name: linkKindLabel(kind),
      image: youtubeThumbnailUrl(url),
    }
    setPreview(local)

    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get<LinkPreviewData>('/api/link-preview', {
          params: { url },
        })
        if (!cancelled) {
          setPreview({
            ...local,
            ...data,
            kind: (data.kind as LinkPreviewData['kind']) || kind,
          })
        }
      } catch {
        // Keep local fallback card
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url])

  if (!url || !preview) return null

  const kind = preview.kind
  const hasRealThumb = Boolean(preview.image)

  // No real image → compact posh chip (Facebook / TikTok / etc.)
  if (!hasRealThumb) {
    return <CompactSocialLink url={url} kind={kind} className={className} />
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'mt-3 block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md',
        className
      )}
    >
      <div className="relative aspect-video w-full bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview.image!}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        {(kind === 'youtube' || kind === 'facebook' || kind === 'tiktok') && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70">
              <Play className="ml-0.5 h-6 w-6 fill-white text-white" />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {preview.site_name || linkKindLabel(kind)}
          </p>
          <p className="line-clamp-2 text-sm font-semibold text-foreground">
            {preview.title || displayHostname(url)}
          </p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </a>
  )
}
