import { useEffect } from "react";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import {
  canAccessVerificationUpload,
  getResidentRoute,
  isPlatformStaff,
  isResidentRole,
  isVerifiedForCurrentCompound,
  needsContactVerification,
} from "@/lib/resident-routing";

const PUBLIC_PREFIXES = ["/auth", "/features"];

const ALLOWED_WHILE_PENDING = [
  "/verification",
  "/verification-pending",
  "/onboarding/compound-select",
  "/onboarding/choose-role",
  "/settings",
  "/(tabs)/profile",
  "/profile",
];

/**
 * Mirrors web RoleGuard for resident verification routing.
 */
export function ResidentVerificationGuard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !user || !pathname) return;
    if (isPlatformStaff(user.role)) return;

    if (needsContactVerification(user)) {
      if (
        pathname.startsWith("/auth/verify-contact") ||
        pathname.startsWith("/auth/login")
      ) {
        return;
      }
      router.replace("/auth/verify-contact");
      return;
    }

    if (!isResidentRole(user.role)) return;
    if (user.status === "APPROVED" && isVerifiedForCurrentCompound(user)) return;

    if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return;
    }

    if (ALLOWED_WHILE_PENDING.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      if (pathname === "/verification" && !canAccessVerificationUpload(user)) {
        router.replace("/verification-pending");
      }
      return;
    }

    router.replace(getResidentRoute(user) as any);
  }, [user, loading, pathname, router]);

  return null;
}
