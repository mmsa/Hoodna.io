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
      return <CheckCircle className="w-5 h-5 text-green-500 animate-bounce" />;
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

  const nationalIdStatus = status?.national_id?.status;
  const contractStatus = status?.contract?.status;
  const bothUploaded = nationalIdStatus && contractStatus;
  const bothApproved = nationalIdStatus === "APPROVED" && contractStatus === "APPROVED";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-16">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header with icon */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Verification Documents
          </h1>
          <p className="text-gray-600 text-lg">
            Upload your documents to get verified and unlock all features
          </p>
        </div>

        {/* Progress indicator */}
        {bothUploaded && !bothApproved && (
          <Card className="border-2 border-yellow-300 bg-gradient-to-r from-yellow-50 to-orange-50 shadow-lg animate-fade-in">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center animate-pulse">
                    <Clock className="w-6 h-6 text-yellow-900" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">Documents Under Review</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Your documents are being reviewed by our team. You'll be notified once verification is complete.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-xl border-2 border-gray-200 hover:shadow-2xl transition-shadow duration-300">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileCheck className="w-6 h-6" />
              Required Documents
            </CardTitle>
            <CardDescription className="text-blue-100">
              Both documents are required for verification
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* National ID */}
            <div className={`border-2 rounded-xl p-6 transition-all duration-300 ${
              uploading === "national_id" 
                ? "border-blue-400 bg-blue-50 shadow-lg scale-[1.02]" 
                : nationalIdStatus === "APPROVED"
                ? "border-green-300 bg-green-50"
                : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-md"
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      nationalIdStatus === "APPROVED" 
                        ? "bg-green-500" 
                        : nationalIdStatus === "PENDING"
                        ? "bg-yellow-500"
                        : "bg-gray-300"
                    } transition-colors duration-300`}>
                      <FileCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">National ID</h3>
                      <p className="text-sm text-gray-600">
                        Upload a clear photo of your national ID
                      </p>
                    </div>
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${getStatusBadgeClass(nationalIdStatus)} transition-all duration-300`}>
                  {getStatusIcon(nationalIdStatus)}
                  <span className="text-sm font-medium">
                    {getStatusText(nationalIdStatus)}
                  </span>
                </div>
              </div>
              
              {/* Upload progress bar */}
              {uploading === "national_id" && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadProgress(0);
                    uploadDocument("national_id", file);
                    // Simulate progress
                    const interval = setInterval(() => {
                      setUploadProgress((prev) => {
                        if (prev >= 70) {
                          clearInterval(interval);
                          return prev;
                        }
                        return prev + 10;
                      });
                    }, 200);
                  }
                }}
                disabled={uploading === "national_id"}
                className="hidden"
                id="national-id-upload"
              />
              <label htmlFor="national-id-upload">
                <Button
                  variant={nationalIdStatus === "APPROVED" ? "outline" : "default"}
                  disabled={uploading === "national_id"}
                  className={`w-full transition-all duration-200 ${
                    uploading === "national_id"
                      ? "opacity-75 cursor-not-allowed"
                      : "hover:scale-[1.02] hover:shadow-md"
                  }`}
                  asChild
                >
                  <span className="flex items-center justify-center">
                    {uploading === "national_id" ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
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
            <div className={`border-2 rounded-xl p-6 transition-all duration-300 ${
              uploading === "contract" 
                ? "border-blue-400 bg-blue-50 shadow-lg scale-[1.02]" 
                : contractStatus === "APPROVED"
                ? "border-green-300 bg-green-50"
                : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-md"
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      contractStatus === "APPROVED" 
                        ? "bg-green-500" 
                        : contractStatus === "PENDING"
                        ? "bg-yellow-500"
                        : "bg-gray-300"
                    } transition-colors duration-300`}>
                      <FileCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">
                        Residency/Ownership Contract
                      </h3>
                      <p className="text-sm text-gray-600">
                        Upload your contract or proof of residency
                      </p>
                    </div>
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${getStatusBadgeClass(contractStatus)} transition-all duration-300`}>
                  {getStatusIcon(contractStatus)}
                  <span className="text-sm font-medium">
                    {getStatusText(contractStatus)}
                  </span>
                </div>
              </div>

              {/* Upload progress bar */}
              {uploading === "contract" && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadProgress(0);
                    uploadDocument("contract", file);
                    // Simulate progress
                    const interval = setInterval(() => {
                      setUploadProgress((prev) => {
                        if (prev >= 70) {
                          clearInterval(interval);
                          return prev;
                        }
                        return prev + 10;
                      });
                    }, 200);
                  }
                }}
                disabled={uploading === "contract"}
                className="hidden"
                id="contract-upload"
              />
              <label htmlFor="contract-upload">
                <Button
                  variant={contractStatus === "APPROVED" ? "outline" : "default"}
                  disabled={uploading === "contract"}
                  className={`w-full transition-all duration-200 ${
                    uploading === "contract"
                      ? "opacity-75 cursor-not-allowed"
                      : "hover:scale-[1.02] hover:shadow-md"
                  }`}
                  asChild
                >
                  <span className="flex items-center justify-center">
                    {uploading === "contract" ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
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
              <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl shadow-lg animate-fade-in">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center animate-bounce">
                      <CheckCircle className="w-7 h-7 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5 text-green-600" />
                      <p className="text-green-900 font-bold text-lg">
                        Verification Complete! 🎉
                      </p>
                    </div>
                    <p className="text-green-800 text-sm mb-4">
                      Congratulations! Your account has been verified. You can now post, comment, and create listings in your community.
                    </p>
                    <Button 
                      onClick={() => router.push("/feed")} 
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                      size="lg"
                    >
                      Go to Community Feed →
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
