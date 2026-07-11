/**
 * Where a resident/USER should land based on compound + verification.
 * verification_status from /me: UNVERIFIED | PENDING | APPROVED | REJECTED
 */
export function getResidentWebRoute(user: {
  role?: string | null
  status?: string | null
  compound_id?: number | null
  verification_status?: string | null
}): string {
  if (!user.compound_id) {
    return '/onboarding/compound-select'
  }

  if (user.status === 'APPROVED') {
    return '/feed'
  }

  if (user.status === 'REJECTED' || user.status === 'BANNED') {
    return '/verification/pending'
  }

  if (user.verification_status === 'PENDING') {
    return '/verification/pending'
  }

  return '/verification'
}

export function isResidentRole(role: string | null | undefined): boolean {
  return role === 'RESIDENT' || role === 'USER'
}

export function getPostAuthWebRoute(user: {
  role?: string | null
  status?: string | null
  compound_id?: number | null
  verification_status?: string | null
}): string {
  if (!user.role) {
    return '/onboarding/choose-role'
  }
  if (isResidentRole(user.role)) {
    return getResidentWebRoute(user)
  }
  if (user.role === 'SERVICE_PROVIDER') {
    return '/provider/status'
  }
  if (user.role === 'COMPOUND_MOD') {
    return '/moderator/status'
  }
  return '/feed'
}
