import { useEffect } from "react";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";

/** Route eljiran:// and https links into in-app screens (reset password, etc.). */
export function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    function handleUrl(url: string) {
      const parsed = Linking.parse(url);
      const path = parsed.path || "";
      const token = typeof parsed.queryParams?.token === "string" ? parsed.queryParams.token : undefined;

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
