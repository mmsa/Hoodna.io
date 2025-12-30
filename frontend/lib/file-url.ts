/**
 * Normalize file URLs to ensure they're absolute.
 * Handles both local storage URLs (/api/uploads/...) and S3 URLs.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function normalizeFileUrl(fileUrl: string | null | undefined): string {
  if (!fileUrl) return ''
  
  // If already absolute (starts with http/https), return as-is
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl
  }
  
  // If relative URL starting with /api/uploads/, make it absolute
  if (fileUrl.startsWith('/api/uploads/')) {
    return `${API_URL}${fileUrl}`
  }
  
  // If relative URL starting with /, make it absolute
  if (fileUrl.startsWith('/')) {
    return `${API_URL}${fileUrl}`
  }
  
  // Otherwise return as-is (might be a data URL or other format)
  return fileUrl
}

