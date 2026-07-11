'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { resolveViewUrl } from '@/lib/upload'
import { normalizeFileUrl, needsPrivateFileUrl } from '@/lib/file-url'
import { Button } from '@/components/ui/button'

export function SignedFileLink({
  fileUrl,
  children,
  className,
}: {
  fileUrl: string
  children?: React.ReactNode
  className?: string
}) {
  const [href, setHref] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    resolveViewUrl(fileUrl).then((url) => {
      if (cancelled) return
      if (url) {
        setHref(url)
      } else if (needsPrivateFileUrl(fileUrl)) {
        setError(true)
      } else {
        setHref(normalizeFileUrl(fileUrl))
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [fileUrl])

  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1 text-sm text-slate-500 ${className || ''}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Preparing link…
      </span>
    )
  }

  if (error || !href) {
    return (
      <span className={`inline-flex items-center gap-1 text-sm text-red-600 ${className || ''}`}>
        <AlertCircle className="h-3.5 w-3.5" />
        Could not load file
      </span>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className || 'inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700'}
    >
      {children || (
        <>
          <ExternalLink className="h-4 w-4" />
          View file
        </>
      )}
    </a>
  )
}

export function SignedFileImage({
  fileUrl,
  alt,
  className,
}: {
  fileUrl: string
  alt?: string
  className?: string
}) {
  const [src, setSrc] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    resolveViewUrl(fileUrl).then((url) => {
      if (cancelled) return
      setSrc(url || (needsPrivateFileUrl(fileUrl) ? '' : normalizeFileUrl(fileUrl)))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [fileUrl])

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className || ''}`}>
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-500 text-sm ${className || ''}`}>
        Preview unavailable
      </div>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt || 'Uploaded file'} className={className} />
}

export function SignedDocumentPreview({
  fileUrl,
  title,
}: {
  fileUrl: string
  title?: string
}) {
  const [viewUrl, setViewUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    resolveViewUrl(fileUrl).then((url) => {
      if (!cancelled) {
        setViewUrl(url)
        setLoadError(!url && needsPrivateFileUrl(fileUrl))
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [fileUrl])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading document…
      </div>
    )
  }

  if (loadError || !viewUrl) {
    return (
      <div className="p-8 text-center border border-red-200 rounded-lg bg-red-50">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-800 font-medium mb-2">Failed to load document</p>
        <SignedFileLink fileUrl={fileUrl}>Open in new tab</SignedFileLink>
      </div>
    )
  }

  const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(fileUrl)

  return (
    <div className="space-y-4">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={viewUrl}
          alt={title || 'Document'}
          className="w-full h-auto rounded-lg border"
          onError={() => setLoadError(true)}
        />
      ) : (
        <iframe
          src={viewUrl}
          className="w-full h-[600px] rounded-lg border"
          title={title || 'Document'}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <a href={viewUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab
          </a>
        </Button>
      </div>
    </div>
  )
}
