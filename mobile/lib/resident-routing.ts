import type { User } from "@hoodna/shared";

function isVerifiedForCurrentCompound(user: User): boolean {
  if (user.is_verified_for_current_compound != null) {
    return user.is_verified_for_current_compound;
  }
  if (!user.compound_id || !user.verified_compound_ids?.length) {
    return false;
  }
  return user.verified_compound_ids.includes(user.compound_id);
}

/**
 * Where a resident/USER should land based on compound + verification.
 * verification_status from /me: UNVERIFIED | PENDING | APPROVED | REJECTED
 */
export function getResidentRoute(user: User): string {
  if (!user.compound_id) {
    return "/onboarding/compound-select";
  }

  if (user.status === "APPROVED" && isVerifiedForCurrentCompound(user)) {
    return "/(tabs)/home";
  }

  if (user.status === "REJECTED" || user.status === "BANNED") {
    return "/verification-pending";
  }

  if (user.verification_status === "REJECTED") {
    return "/verification-pending";
  }

  // PENDING_VERIFICATION: docs submitted → status page; otherwise upload
  if (user.verification_status === "PENDING") {
    return "/verification-pending";
  }

  return "/verification";
}

export function canAccessVerificationUpload(user: User): boolean {
  if (user.status === "APPROVED" && !isVerifiedForCurrentCompound(user)) return true;
  if (user.status === "APPROVED") return false;
  if (user.verification_status === "REJECTED") return true;
  if (user.status === "REJECTED" || user.status === "BANNED") return true;
  if (user.verification_status === "UNVERIFIED" || user.verification_status == null) return true;
  return false;
}

export function isResidentRole(role: string | null | undefined): boolean {
  return role === "RESIDENT" || role === "USER";
}

export function verificationDocumentsNeedReupload(status?: {
  national_id?: { status?: string } | null;
  contract?: { status?: string } | null;
} | null): boolean {
  const docStatuses = [status?.national_id?.status, status?.contract?.status];
  return docStatuses.some(
    (s) => s === "REJECTED" || s === "REQUEST_MORE_DETAILS"
  );
}

export function isVerificationRejected(
  user: User,
  status?: {
    national_id?: { status?: string } | null;
    contract?: { status?: string } | null;
  } | null
): boolean {
  return (
    user.status === "REJECTED" ||
    user.status === "BANNED" ||
    user.verification_status === "REJECTED" ||
    verificationDocumentsNeedReupload(status)
  );
}

/** Post-auth destination for any logged-in user. */
export function getPostAuthRoute(user: User): string {
  if (!user.role) {
    return "/onboarding/choose-role";
  }
  if (isResidentRole(user.role)) {
    return getResidentRoute(user);
  }
  if (user.role === "SERVICE_PROVIDER") {
    return "/provider/status";
  }
  if (user.role === "COMPOUND_MOD") {
    return "/moderator/status";
  }
  return "/(tabs)/home";
}
