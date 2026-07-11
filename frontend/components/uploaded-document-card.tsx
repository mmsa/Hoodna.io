'use client'

import { CheckCircle, ExternalLink, FileText } from 'lucide-react'
import { normalizeFileUrl } from '@/lib/file-url'

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

  const url = normalizeFileUrl(fileUrl || '')

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{title}</p>
          <p className="text-sm text-slate-500 truncate">{fileNameFromUrl(url || title)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(status || undefined)}`}>
          {statusLabel(status || undefined)}
        </span>
      </div>

      {url && isImage(url) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={title}
          className="w-full max-h-56 object-contain rounded-lg border border-slate-100 bg-slate-50"
        />
      )}

      {url && isPdf(url) && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-sm text-slate-700">
          <FileText className="h-4 w-4 text-slate-500" />
          PDF document on file
        </div>
      )}

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <ExternalLink className="h-4 w-4" />
          View uploaded file
        </a>
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
