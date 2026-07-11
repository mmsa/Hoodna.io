/**
 * Utility functions for formatting enum values to human-readable text
 */

/**
 * Format provider type enum to human-readable text
 */
export function formatProviderType(type: string | null | undefined): string {
  if (!type) return 'N/A'
  const typeMap: Record<string, string> = {
    'INDIVIDUAL': 'Individual',
    'REGISTERED_BUSINESS': 'Registered Business',
  }
  return typeMap[type] || type
}

/**
 * Format verification method enum to human-readable text
 */
export function formatVerificationMethod(method: string | null | undefined): string {
  if (!method) return 'N/A'
  const methodMap: Record<string, string> = {
    'COMMERCIAL_REGISTER': 'Commercial Register',
    'NATIONAL_ID_OCCUPATION': 'National ID + Occupation',
  }
  return methodMap[method] || method
}

/**
 * Format provider status enum to human-readable text
 */
export function formatProviderStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown'
  const statusMap: Record<string, string> = {
    'DRAFT': 'Draft',
    'SUBMITTED': 'Submitted',
    'IN_REVIEW': 'In Review',
    'APPROVED': 'Approved',
    'REJECTED': 'Rejected',
    'SUSPENDED': 'Suspended',
  }
  return statusMap[status] || status
}

/**
 * Format moderator status enum to human-readable text
 */
export function formatModeratorStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown'
  const statusMap: Record<string, string> = {
    'DRAFT': 'Draft',
    'SUBMITTED': 'Submitted',
    'IN_REVIEW': 'In Review',
    'APPROVED': 'Approved',
    'REJECTED': 'Rejected',
    'SUSPENDED': 'Suspended',
  }
  return statusMap[status] || status
}

/**
 * Format document type to human-readable text
 */
export function formatDocumentType(documentType: string | null | undefined): string {
  if (!documentType) return 'Unknown'
  const typeMap: Record<string, string> = {
    'NATIONAL_ID_FRONT': 'National ID (Front)',
    'NATIONAL_ID_BACK': 'National ID (Back)',
    'COMMERCIAL_REGISTER': 'Commercial Register',
    'TAX_CARD': 'Tax Card',
    'AUTHORIZATION_LETTER': 'Authorization Letter',
    'NATIONAL_ID': 'National ID',
    'CONTRACT': 'Residency/Ownership Contract',
  }
  return typeMap[documentType] || documentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export function formatUserRole(role: string | null | undefined): string {
  if (!role) return 'Not set'
  const roleMap: Record<string, string> = {
    USER: 'Resident',
    RESIDENT: 'Resident',
    ADMIN: 'Admin',
    MODERATOR: 'Moderator',
    COMPOUND_MOD: 'Compound Moderator',
    SERVICE_PROVIDER: 'Service Provider',
  }
  return roleMap[role] || role
}

export function formatUserStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown'
  const statusMap: Record<string, string> = {
    PENDING_VERIFICATION: 'Pending Verification',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    BANNED: 'Banned',
  }
  return statusMap[status] || status
}

