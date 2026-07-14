import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";
import type { ApiClient } from "@hoodna/shared";
import { uploadLocalFileToPresignedUrl } from "@/lib/upload";

type OnboardingOwner = "providers" | "moderators";

export async function pickAndUploadOnboardingDocument(
  apiClient: ApiClient,
  owner: OnboardingOwner,
  documentType: string,
): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/*", "application/pdf"],
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;

  const file = result.assets[0];
  const params = new URLSearchParams({
    document_type: documentType,
    file_name: file.name,
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
      fileName: file.name,
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
