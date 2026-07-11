import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ImageStyle, StyleProp, View } from "react-native";
import type { ApiClient } from "@hoodna/shared";
import { normalizeFileUrl, resolveViewUrl } from "@/lib/file-url";

export function SignedImage({
  fileUrl,
  apiClient,
  style,
  resizeMode = "contain",
}: {
  fileUrl: string | null | undefined;
  apiClient?: ApiClient;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain" | "stretch" | "repeat" | "center";
}) {
  const [src, setSrc] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    resolveViewUrl(fileUrl, apiClient).then((url) => {
      if (!cancelled) {
        setSrc(url);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fileUrl, apiClient]);

  if (!fileUrl) return null;

  if (loading) {
    return (
      <View style={[style, { alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6" }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!src) return null;

  return <Image source={{ uri: src }} style={style} resizeMode={resizeMode} />;
}

export function useSignedFileUrl(
  fileUrl: string | null | undefined,
  apiClient?: ApiClient
): string {
  const [url, setUrl] = useState(normalizeFileUrl(fileUrl));

  useEffect(() => {
    let cancelled = false;
    resolveViewUrl(fileUrl, apiClient).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [fileUrl, apiClient]);

  return url;
}
