import { File } from "expo-file-system";

export type LocalUploadFile = {
  uri: string;
  mimeType: string;
  fileName: string;
};

function isApiUploadUrl(presignedUrl: string): boolean {
  return (
    presignedUrl.includes("/api/uploads/upload") ||
    presignedUrl.includes("/api/uploads/s3")
  );
}

/**
 * Upload a device file (camera roll / camera capture) to a presigned URL.
 * React Native requires FormData with { uri, type, name } — not Blob from fetch(uri).
 */
export async function uploadLocalFileToPresignedUrl(
  presignedUrl: string,
  file: LocalUploadFile,
  authToken?: string
): Promise<void> {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  if (isApiUploadUrl(presignedUrl)) {
    const formData = new FormData();
    formData.append("file", {
      uri: file.uri,
      type: file.mimeType,
      name: file.fileName,
    } as unknown as Blob);

    const uploadResponse = await fetch(presignedUrl, {
      method: "POST",
      body: formData,
      headers,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => "");
      throw new Error(
        `Upload failed (${uploadResponse.status}): ${errorText || uploadResponse.statusText}`
      );
    }
    return;
  }

  const body = await new File(file.uri).arrayBuffer();
  const uploadResponse = await fetch(presignedUrl, {
    method: "PUT",
    body,
    headers: {
      "Content-Type": file.mimeType,
      ...headers,
    },
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => "");
    throw new Error(
      `Upload failed (${uploadResponse.status}): ${errorText || uploadResponse.statusText}`
    );
  }
}

/** @deprecated Use uploadLocalFileToPresignedUrl for device files. */
export async function uploadToPresignedUrl(
  presignedUrl: string,
  blob: Blob,
  contentType?: string,
  authToken?: string
): Promise<void> {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  if (isApiUploadUrl(presignedUrl)) {
    const formData = new FormData();
    formData.append("file", blob as unknown as Blob);
    const urlParams = new URL(presignedUrl).searchParams;
    const filePath = urlParams.get("file_path");
    if (filePath) {
      formData.append("file_path", filePath);
    }
    const uploadResponse = await fetch(presignedUrl, {
      method: "POST",
      body: formData,
      headers,
    });
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => "");
      throw new Error(
        `Upload failed (${uploadResponse.status}): ${errorText || uploadResponse.statusText}`
      );
    }
    return;
  }

  const uploadResponse = await fetch(presignedUrl, {
    method: "PUT",
    body: blob,
    headers: {
      "Content-Type": contentType || "application/octet-stream",
      ...headers,
    },
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => "");
    throw new Error(
      `Upload failed (${uploadResponse.status}): ${errorText || uploadResponse.statusText}`
    );
  }
}
