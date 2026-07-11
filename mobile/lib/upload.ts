/**
 * Upload a blob via API proxy (S3) or local FormData POST.
 */
export async function uploadToPresignedUrl(
  presignedUrl: string,
  blob: Blob,
  contentType?: string,
  authToken?: string
): Promise<void> {
  const useApiUpload =
    presignedUrl.includes("/api/uploads/upload") ||
    presignedUrl.includes("/api/uploads/s3");

  const headers: Record<string, string> = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let uploadResponse: Response;

  if (useApiUpload) {
    const formData = new FormData();
    formData.append("file", blob as any);
    const urlParams = new URL(presignedUrl).searchParams;
    const filePath = urlParams.get("file_path");
    if (filePath) {
      formData.append("file_path", filePath);
    }
    uploadResponse = await fetch(presignedUrl, {
      method: "POST",
      body: formData,
      headers,
    });
  } else {
    uploadResponse = await fetch(presignedUrl, {
      method: "PUT",
      body: blob,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        ...headers,
      },
    });
  }

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => "");
    throw new Error(
      `Upload failed (${uploadResponse.status}): ${errorText || uploadResponse.statusText}`
    );
  }
}
