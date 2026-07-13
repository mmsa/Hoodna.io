'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { normalizeFileUrl, needsPrivateFileUrl } from '@/lib/file-url'
import { resolveViewUrl } from '@/lib/upload'

type DocStatus = string | undefined

function statusLabel(status: DocStatus) {
  if (!status) return 'Not uploaded'
  if (status === 'APPROVED') return 'Approved'
  if (status === 'REJECTED') return 'Rejected'
  if (status === 'REQUEST_MORE_DETAILS') return 'More details needed'
  return 'Uploaded — under review'
}

function statusClass(status: DocStatus) {
  if (!status) return 'bg-slate-100 text-slate-600'
  if (status === 'APPROVED') return 'bg-green-100 text-green-800'
  if (status === 'REJECTED') return 'bg-red-100 text-red-800'
  return 'bg-amber-100 text-amber-900'
}

function isImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)
}

function isPdf(url: string) {
  return /\.pdf(\?|$)/i.test(url)
}

function fileNameFromUrl(url: string) {
  try {
    const path = url.split('?')[0]
    return decodeURIComponent(path.split('/').pop() || 'Document')
  } catch {
    return 'Document'
  }
}

export function UploadedDocumentCard({
  title,
  status,
  fileUrl,
}: {
  title: string
  status?: string | null
  fileUrl?: string | null
}) {
  const storedUrl = normalizeFileUrl(fileUrl || '')
  const [viewUrl, setViewUrl] = useState(storedUrl)
  const [loadingUrl, setLoadingUrl] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function resolve() {
      if (!storedUrl) {
        setViewUrl('')
        return
      }
      if (!needsPrivateFileUrl(storedUrl)) {
        setViewUrl(storedUrl)
        return
      }
      setLoadingUrl(true)
      try {
        const url = await resolveViewUrl(fileUrl || storedUrl)
        if (!cancelled) {
          setViewUrl(url)
        }
      } catch {
        if (!cancelled) setViewUrl('')
      } finally {
        if (!cancelled) setLoadingUrl(false)
      }
    }
    resolve()
    return () => {
      cancelled = true
    }
  }, [fileUrl, storedUrl])

  if (!status && !fileUrl) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-slate-900">{title}</p>
            <p className="text-sm text-slate-500">Not uploaded yet</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(undefined)}`}>
            Not uploaded
          </span>
        </div>
      </div>
    )
  }

  const url = viewUrl || storedUrl

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{title}</p>
          <p className="text-sm text-slate-500 truncate">{fileNameFromUrl(storedUrl || title)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(status || undefined)}`}>
          {statusLabel(status || undefined)}
        </span>
      </div>

      {loadingUrl && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing secure preview…
        </div>
      )}

      {url && isImage(storedUrl) && !loadingUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={title}
          className="w-full max-h-56 object-contain rounded-lg border border-slate-100 bg-slate-50"
        />
      )}

      {url && isPdf(storedUrl) && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-sm text-slate-700">
          <FileText className="h-4 w-4 text-slate-500" />
          PDF document on file
        </div>
      )}

      {url && !loadingUrl && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary"
        >
          <ExternalLink className="h-4 w-4" />
          View uploaded file
        </a>
      )}

      {!url && !loadingUrl && storedUrl && needsPrivateFileUrl(storedUrl) && (
        <p className="text-sm text-red-600">Could not prepare file link. Refresh and try again.</p>
      )}

      {status && status !== 'REJECTED' && (
        <p className="flex items-center gap-1.5 text-xs text-green-700">
          <CheckCircle className="h-3.5 w-3.5" />
          Saved — this stays after you refresh
        </p>
      )}
    </div>
  )
}
