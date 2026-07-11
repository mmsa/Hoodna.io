import api from '@/lib/api'
import { normalizeFileUrl } from '@/lib/file-url'

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

/** Same MIME type for presign + PUT (must match S3 signature). */
export function resolveUploadContentType(file: File): string {
  const fromBrowser = (file.type || '').toLowerCase().trim()
  if (fromBrowser && fromBrowser !== 'application/octet-stream') {
    return fromBrowser
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext]
  return fromBrowser || 'application/octet-stream'
}

/**
 * Upload a browser File to a presigned URL (S3 PUT, or local FormData POST).
 */
export async function uploadToPresignedUrl(
  presignedUrl: string,
  file: File,
  contentType?: string
): Promise<void> {
  const mimeType = contentType || resolveUploadContentType(file)
  const isLocalStorage = presignedUrl.includes('/api/uploads/upload')
  let uploadResponse: Response

  if (isLocalStorage) {
    const formData = new FormData()
    formData.append('file', file)
    const urlParams = new URL(presignedUrl).searchParams
    const filePath = urlParams.get('file_path')
    if (filePath) {
      formData.append('file_path', filePath)
    }
    uploadResponse = await fetch(presignedUrl, {
      method: 'POST',
      body: formData,
    })
  } else {
    try {
      uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': mimeType,
        },
      })
    } catch {
      throw new Error(
        'Could not reach storage (browser blocked the upload). Configure S3 CORS to allow PUT from this site — see DEPLOY_RENDER_VERCEL.md.'
      )
    }
  }

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => '')
    throw new Error(
      `Upload failed (${uploadResponse.status}): ${errorText || uploadResponse.statusText}`
    )
  }
}

/**
 * Resolve a stored file URL to a browser-viewable URL (signed for private S3).
 */
export async function resolveViewUrl(fileUrl: string | null | undefined): Promise<string> {
  const stored = normalizeFileUrl(fileUrl || '')
  if (!stored) return ''
  if (!stored.includes('amazonaws.com') && !stored.includes('s3.')) {
    return stored
  }
  try {
    const res = await api.get('/api/uploads/signed-url', {
      params: { file_url: stored },
    })
    return res.data.url || stored
  } catch {
    // Fallback to verification endpoint (older deploys)
    try {
      const res = await api.get('/api/verification/signed-url', {
        params: { file_url: stored },
      })
      return res.data.url || stored
    } catch {
      return stored
    }
  }
}
