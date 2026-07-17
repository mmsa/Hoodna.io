import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";
import type { ApiClient } from "@hoodna/shared";
import { pickImageSource, type ImageSourceCopy } from "@/lib/pick-media";
import { uploadLocalFileToPresignedUrl } from "@/lib/upload";

type OnboardingOwner = "providers" | "moderators";

export async function pickAndUploadOnboardingDocument(
  apiClient: ApiClient,
  owner: OnboardingOwner,
  documentType: string,
  options?: {
    imageOnly?: boolean;
    imageSourceCopy?: ImageSourceCopy;
  },
): Promise<string | null> {
  const file = options?.imageOnly
    ? await pickImageSource({
        quality: 0.9,
        copy: options.imageSourceCopy,
      })
    : await (async () => {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["image/*", "application/pdf"],
          copyToCacheDirectory: true,
        });
        return result.canceled ? null : result.assets[0];
      })();

  if (!file) return null;

  const params = new URLSearchParams({
    document_type: documentType,
    file_name: "name" in file ? file.name : file.fileName,
    file_type: file.mimeType || "application/octet-stream",
  });
  const presign = await apiClient.request<{
    presigned_url: string;
    file_url: string;
  }>(`/api/${owner}/documents/upload-url?${params.toString()}`, {
    method: "POST",
  });

  const token = await SecureStore.getItemAsync("accessToken");
  await uploadLocalFileToPresignedUrl(
    presign.presigned_url,
    {
      uri: file.uri,
      mimeType: file.mimeType || "application/octet-stream",
      fileName: "name" in file ? file.name : file.fileName,
    },
    token ?? undefined,
  );

  await apiClient.request(`/api/${owner}/documents`, {
    method: "POST",
    body: JSON.stringify({
      document_type: documentType,
      file_url: presign.file_url,
    }),
  });

  return presign.file_url;
}
