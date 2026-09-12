import Cookies from 'js-cookie'
import api from '@/lib/api'
import { normalizeFileUrl, needsPrivateFileUrl } from '@/lib/file-url'

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

/** Same MIME type for presign + upload (must match backend). */
export function resolveUploadContentType(file: File): string {
  const fromBrowser = (file.type || '').toLowerCase().trim()
  if (fromBrowser && fromBrowser !== 'application/octet-stream') {
    return fromBrowser
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext]
  return fromBrowser || 'application/octet-stream'
}

function isApiUploadUrl(presignedUrl: string): boolean {
  return (
    presignedUrl.includes('/api/uploads/upload') ||
    presignedUrl.includes('/api/uploads/s3')
  )
}

/** Path + query for axios (uses auth interceptors + token refresh). */
function apiUploadPath(presignedUrl: string): string {
  try {
    const url = new URL(presignedUrl)
    return `${url.pathname}${url.search}`
  } catch {
    return presignedUrl
  }
}

function authHeaders(): HeadersInit {
  const token = Cookies.get('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Uploads must not inherit the shared 20s API timeout. The backend accepts
 * documents up to 15 MB, which is several minutes on a slow mobile connection,
 * and a timeout here silently breaks verification onboarding.
 */
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000

const UPLOAD_FAILED_MESSAGE =
  'Upload failed. Check your connection and try again, or email hello@eljiran.io if this keeps happening.'

/**
 * Upload a browser File to a presigned URL.
 * Production uses API → S3 proxy; dev may use local disk or direct S3 PUT.
 */
export async function uploadToPresignedUrl(
  presignedUrl: string,
  file: File,
  contentType?: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const mimeType = contentType || resolveUploadContentType(file)

  if (isApiUploadUrl(presignedUrl)) {
    const formData = new FormData()
    formData.append('file', file)
    const urlParams = new URL(presignedUrl).searchParams
    const filePath = urlParams.get('file_path')
    if (filePath) {
      formData.append('file_path', filePath)
    }
    try {
      // axios adds Bearer token + retries on 401
      await api.post(apiUploadPath(presignedUrl), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT_MS,
        onUploadProgress: onProgress
          ? (event) => {
              if (event.total) {
                onProgress(Math.round((event.loaded / event.total) * 100))
              }
            }
          : undefined,
      })
    } catch (error) {
      // Surface the server's own validation message (file too large, wrong
      // type) but never a raw response body or stack.
      const detail = (error as any)?.response?.data?.detail
      throw new Error(typeof detail === 'string' ? detail : UPLOAD_FAILED_MESSAGE)
    }
    return
  }

  let uploadResponse: Response
  try {
    uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': mimeType,
        ...authHeaders(),
      },
    })
  } catch {
    throw new Error(
      'Could not reach storage. Try again or email hello@eljiran.io if this persists.'
    )
  }

  if (!uploadResponse.ok) {
    throw new Error(UPLOAD_FAILED_MESSAGE)
  }
}

/**
 * Resolve a stored file URL to a browser-viewable URL (signed for private S3).
 */
export async function resolveViewUrl(fileUrl: string | null | undefined): Promise<string> {
  const stored = normalizeFileUrl(fileUrl || '')
  if (!stored) return ''
  if (!needsPrivateFileUrl(stored)) return stored
  try {
    const res = await api.get('/api/uploads/signed-url', {
      params: { file_url: stored },
    })
    if (res.data?.url) return res.data.url
  } catch {
    // fall through to verification endpoint
  }
  try {
    const res = await api.get('/api/verification/signed-url', {
      params: { file_url: stored },
    })
    if (res.data?.url) return res.data.url
  } catch {
    // fail closed — never return a raw private S3 URL
  }
  return ''
}
