import type { User } from "@hoodna/shared";

/**
 * Where a resident/USER should land based on compound + verification.
 * verification_status from /me: UNVERIFIED | PENDING | APPROVED | REJECTED
 */
export function getResidentRoute(user: User): string {
  if (!user.compound_id) {
    return "/onboarding/compound-select";
  }

  if (user.status === "APPROVED") {
    return "/(tabs)/home";
  }

  if (user.status === "REJECTED" || user.status === "BANNED") {
    return "/verification-pending";
  }

  // PENDING_VERIFICATION: docs submitted → status page; otherwise upload
  if (user.verification_status === "PENDING") {
    return "/verification-pending";
  }

  return "/verification";
}

export function isResidentRole(role: string | null | undefined): boolean {
  return role === "RESIDENT" || role === "USER";
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
