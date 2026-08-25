'use client'

import { useEffect, useState } from 'react'
import {
  classifyLinkHost,
  displayHostname,
  extractUrls,
  firstHttpUrl,
  linkKindLabel,
  youtubeThumbnailUrl,
  type LinkPreviewData,
} from '@hoodna/shared'
import { ExternalLink } from 'lucide-react'
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
  return <p className={cn('whitespace-pre-wrap break-words', className)}>{linkifyText(text)}</p>
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
      title: linkKindLabel(kind),
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

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'mt-3 block overflow-hidden rounded-[16px] border border-border bg-muted/40 transition-colors hover:bg-muted/70',
        className
      )}
    >
      {preview.image ? (
        <div className="relative aspect-video w-full bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
          <ExternalLink className="h-8 w-8 text-primary/70" />
        </div>
      )}
      <div className="space-y-1 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {preview.site_name || linkKindLabel(preview.kind)}
        </p>
        <p className="line-clamp-2 text-sm font-semibold text-foreground">
          {preview.title || displayHostname(url)}
        </p>
        {preview.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{preview.description}</p>
        ) : null}
      </div>
    </a>
  )
}
