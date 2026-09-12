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

const UPLOAD_FAILED_MESSAGE =
  "Upload failed. Check your connection and try again.";

/**
 * Turn a failed upload response into a message worth showing in an alert.
 * The server's own `detail` is user-facing copy (file too large, wrong type);
 * anything else would be a raw body or HTML error page, so it is replaced.
 */
async function uploadError(response: Response): Promise<Error> {
  if (response.status === 413) {
    return new Error("That file is too large. Please choose a smaller one.");
  }
  if (response.status === 401 || response.status === 403) {
    return new Error("Your session expired. Please sign in again.");
  }
  try {
    const body = await response.json();
    if (typeof body?.detail === "string" && body.detail.length < 300) {
      return new Error(body.detail);
    }
  } catch {
    // Non-JSON body — fall through to the generic message.
  }
  return new Error(UPLOAD_FAILED_MESSAGE);
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
      throw await uploadError(uploadResponse);
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
    throw await uploadError(uploadResponse);
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
      throw await uploadError(uploadResponse);
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
    throw await uploadError(uploadResponse);
  }
}
