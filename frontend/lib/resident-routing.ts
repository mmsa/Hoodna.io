/**
 * Where a resident/USER should land based on compound + verification.
 * verification_status from /me: UNVERIFIED | PENDING | APPROVED | REJECTED
 */
export function isVerifiedForCurrentCompound(user: {
  compound_id?: number | null
  verified_compound_ids?: number[] | null
  is_verified_for_current_compound?: boolean | null
}): boolean {
  if (user.is_verified_for_current_compound != null) {
    return user.is_verified_for_current_compound
  }
  if (!user.compound_id || !user.verified_compound_ids?.length) {
    return false
  }
  return user.verified_compound_ids.includes(user.compound_id)
}

export function getResidentWebRoute(user: {
  role?: string | null
  status?: string | null
  compound_id?: number | null
  verification_status?: string | null
  verified_compound_ids?: number[] | null
  is_verified_for_current_compound?: boolean | null
  needs_profile_setup?: boolean | null
}): string {
  if (user.needs_profile_setup) {
    return '/profile'
  }

  if (!user.compound_id) {
    return '/onboarding/compound-select'
  }

  if (user.status === 'APPROVED' && isVerifiedForCurrentCompound(user)) {
    return '/feed'
  }

  if (user.status === 'REJECTED' || user.status === 'BANNED') {
    return '/verification/pending'
  }

  if (user.verification_status === 'REJECTED') {
    return '/verification/pending'
  }

  if (user.verification_status === 'PENDING') {
    return '/verification/pending'
  }

  return '/verification'
}

/** True when the user should be allowed on /verification to upload or re-upload. */
export function canAccessVerificationUpload(user: {
  status?: string | null
  verification_status?: string | null
  compound_id?: number | null
  verified_compound_ids?: number[] | null
  is_verified_for_current_compound?: boolean | null
}): boolean {
  if (user.status === 'APPROVED' && !isVerifiedForCurrentCompound(user)) return true
  if (user.status === 'APPROVED') return false
  if (user.verification_status === 'REJECTED') return true
  if (user.status === 'REJECTED' || user.status === 'BANNED') return true
  if (user.verification_status === 'UNVERIFIED' || !user.verification_status) return true
  return false
}

export function isResidentRole(role: string | null | undefined): boolean {
  return role === 'RESIDENT' || role === 'USER'
}

export function getPostAuthWebRoute(user: {
  role?: string | null
  status?: string | null
  compound_id?: number | null
  verification_status?: string | null
  verified_compound_ids?: number[] | null
  is_verified_for_current_compound?: boolean | null
  needs_profile_setup?: boolean | null
}): string {
  if (user.needs_profile_setup) {
    return '/profile'
  }
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
