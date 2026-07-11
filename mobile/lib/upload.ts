/**
 * Upload a blob to a presigned URL (S3 PUT, or local FormData POST).
 */
export async function uploadToPresignedUrl(
  presignedUrl: string,
  blob: Blob,
  contentType?: string
): Promise<void> {
  const isLocalStorage = presignedUrl.includes("/api/uploads/upload");
  let uploadResponse: Response;

  if (isLocalStorage) {
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
    });
  } else {
    uploadResponse = await fetch(presignedUrl, {
      method: "PUT",
      body: blob,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
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
