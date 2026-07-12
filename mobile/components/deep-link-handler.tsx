import { useEffect } from "react";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { savePendingReferralCode } from "@/lib/referral";

/** Route eljiran:// and https links into in-app screens (reset password, etc.). */
export function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    function handleUrl(url: string) {
      const parsed = Linking.parse(url);
      const path = parsed.path || "";
      const token = typeof parsed.queryParams?.token === "string" ? parsed.queryParams.token : undefined;
      const referral =
        typeof parsed.queryParams?.ref === "string"
          ? parsed.queryParams.ref
          : typeof parsed.queryParams?.referral_code === "string"
            ? parsed.queryParams.referral_code
            : undefined;

      if ((path === "signup" || path === "auth/signup") && referral) {
        void savePendingReferralCode(referral);
        router.push(`/auth/signup?ref=${encodeURIComponent(referral)}`);
        return;
      }

      const referralPathMatch = path.match(/^(?:invite|referral)\/([^/]+)$/);
      if (referralPathMatch?.[1]) {
        const code = decodeURIComponent(referralPathMatch[1]);
        void savePendingReferralCode(code);
        router.push(`/auth/signup?ref=${encodeURIComponent(code)}`);
        return;
      }

      const businessMatch = path.match(/^businesses\/([^/]+)$/);
      if (businessMatch?.[1]) {
        router.push(`/businesses/${encodeURIComponent(decodeURIComponent(businessMatch[1]))}`);
        return;
      }

      if (path.includes("auth/reset-password") && token) {
        router.push(`/auth/reset-password?token=${encodeURIComponent(token)}`);
        return;
      }

      if (path.includes("auth/forgot-password")) {
        router.push("/auth/forgot-password");
      }
    }

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [router]);

  return null;
}
