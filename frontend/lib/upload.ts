import api from '@/lib/api'
import { normalizeFileUrl } from '@/lib/file-url'

/**
 * Upload a browser File to a presigned URL (S3 PUT, or local FormData POST).
 */
export async function uploadToPresignedUrl(
  presignedUrl: string,
  file: File
): Promise<void> {
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
    // S3 (or compatible): PUT object body
    uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
    })
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
