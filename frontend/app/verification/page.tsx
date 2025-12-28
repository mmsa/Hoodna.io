"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import api from "@/lib/api";
import { Upload, CheckCircle, XCircle, Clock, FileCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VerificationStatus {
  national_id: {
    id: number;
    type: string;
    file_url: string;
    status: string;
    created_at: string;
  } | null;
  contract: {
    id: number;
    type: string;
    file_url: string;
    status: string;
    created_at: string;
  } | null;
  user_status: string;
  can_post: boolean;
}

export default function VerificationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [uploading, setUploading] = useState<"national_id" | "contract" | null>(
    null
  );
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const { data: status, refetch } = useQuery<VerificationStatus>({
    queryKey: ["verification-status"],
    queryFn: async () => {
      const response = await api.get("/api/verification/status");
      return response.data;
    },
  });

  const uploadDocument = async (
    type: "national_id" | "contract",
    file: File
  ) => {
    setUploading(type);

    try {
      // Get presigned URL
      const documentType = type === "national_id" ? "NATIONAL_ID" : "CONTRACT";
      const presignResponse = await api.post("/api/verification/presign", {
        file_name: file.name,
        file_type: file.type,
        document_type: documentType,
      });

      const { presigned_url, file_url } = presignResponse.data;

      if (!presigned_url || !file_url) {
        throw new Error("Failed to get upload URL from server");
      }

      // Check if this is a local storage upload (presigned_url contains /api/uploads/upload)
      const isLocalStorage = presigned_url.includes('/api/uploads/upload');
      
      let uploadResponse: Response;
      try {
        if (isLocalStorage) {
          // Local storage: use FormData and POST
          const formData = new FormData();
          formData.append('file', file);
          // Extract file_path from URL if present
          const urlParams = new URL(presigned_url).searchParams;
          const filePath = urlParams.get('file_path');
          if (filePath) {
            formData.append('file_path', filePath);
          }
          
          uploadResponse = await fetch(presigned_url, {
            method: "POST",
            body: formData,
          });
        } else {
          // S3: use PUT with file as body
          uploadResponse = await fetch(presigned_url, {
            method: "PUT",
            body: file,
            headers: {
              "Content-Type": file.type,
            },
          });
        }
      } catch (fetchError: any) {
        throw new Error(`Failed to upload file: ${fetchError?.message || 'Network error'}`);
      }

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => 'Unable to read error response');
        throw new Error(`Upload failed (${uploadResponse.status} ${uploadResponse.statusText}): ${errorText || 'Unknown error'}`);
      }

      // Submit document
      setUploadProgress(80);
      await api.post("/api/verification/submit", {
        file_url,
        document_type: documentType,
      });

      setUploadProgress(100);
      await refetch();
      
      toast({
        title: "Document uploaded successfully! 🎉",
        description: `${type === "national_id" ? "National ID" : "Contract"} has been submitted for review.`,
        variant: "success",
      });
    } catch (error: any) {
      console.error("Upload failed:", error);
      const errorMessage = error?.response?.data?.detail || error?.message || "Upload failed. Please try again.";
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploading(null);
      setUploadProgress(0);
    }
  };

  const getStatusIcon = (docStatus: string | undefined) => {
    if (!docStatus) return <Clock className="w-5 h-5 text-gray-400 animate-pulse" />;
    if (docStatus === "APPROVED")
      return <CheckCircle className="w-5 h-5 text-green-500 animate-in zoom-in duration-300" />;
    if (docStatus === "REJECTED")
      return <XCircle className="w-5 h-5 text-red-500" />;
    return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
  };

  const getStatusText = (docStatus: string | undefined) => {
    if (!docStatus) return "Not uploaded";
    if (docStatus === "APPROVED") return "Approved";
    if (docStatus === "REJECTED") return "Rejected";
    return "Pending review";
  };

  const getStatusBadgeClass = (docStatus: string | undefined) => {
    if (!docStatus) return "bg-gray-100 text-gray-700";
    if (docStatus === "APPROVED") return "bg-green-100 text-green-700 border-green-300";
    if (docStatus === "REJECTED") return "bg-red-100 text-red-700 border-red-300";
    return "bg-yellow-100 text-yellow-700 border-yellow-300";
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Verification Documents</CardTitle>
            <CardDescription>
              Upload your National ID and residency/ownership contract to get
              verified
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* National ID */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">National ID</h3>
                  <p className="text-sm text-gray-600">
                    Upload a clear photo of your national ID
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(status?.national_id?.status)}
                  <span className="text-sm">
                    {getStatusText(status?.national_id?.status)}
                  </span>
                </div>
              </div>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (file) uploadDocument("national_id", file);
                }}
                disabled={uploading === "national_id"}
                className="hidden"
                id="national-id-upload"
              />
              <label htmlFor="national-id-upload">
                <Button
                  variant="outline"
                  disabled={uploading === "national_id"}
                  className="w-full"
                  asChild
                >
                  <span>
                    {uploading === "national_id" ? (
                      "Uploading..."
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {status?.national_id
                          ? "Replace Document"
                          : "Upload Document"}
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>

            {/* Contract */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">
                    Residency/Ownership Contract
                  </h3>
                  <p className="text-sm text-gray-600">
                    Upload your contract or proof of residency
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(status?.contract?.status)}
                  <span className="text-sm">
                    {getStatusText(status?.contract?.status)}
                  </span>
                </div>
              </div>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (file) uploadDocument("contract", file);
                }}
                disabled={uploading === "contract"}
                className="hidden"
                id="contract-upload"
              />
              <label htmlFor="contract-upload">
                <Button
                  variant="outline"
                  disabled={uploading === "contract"}
                  className="w-full"
                  asChild
                >
                  <span>
                    {uploading === "contract" ? (
                      "Uploading..."
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {status?.contract
                          ? "Replace Document"
                          : "Upload Document"}
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>

            {status?.can_post && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-semibold">
                  ✓ Verification Complete!
                </p>
                <p className="text-green-700 text-sm mt-1">
                  You can now post, comment, and create listings.
                </p>
                <Button onClick={() => router.push("/feed")} className="mt-4">
                  Go to Feed
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
