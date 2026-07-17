"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import api from "@/lib/api";
import { Upload, CheckCircle, XCircle, Clock, FileCheck, ShieldCheck, Sparkles, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { UploadedDocumentCard } from "@/components/uploaded-document-card";
import { uploadToPresignedUrl, resolveUploadContentType } from "@/lib/upload";
import { isVerifiedForCurrentCompound } from "@/lib/resident-routing";
import { VerificationCompoundBar } from "@/components/verification-compound-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignOutButton } from "@/components/sign-out-button";

type DocumentType = "national_id" | "contract";

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
  compound_id?: number | null;
  compound_name?: string | null;
}

export default function VerificationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading: userLoading } = useAuth();
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  // Store uploaded file URLs before submission
  const [pendingNationalId, setPendingNationalId] = useState<string | null>(null);
  const [pendingContract, setPendingContract] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearProgressInterval = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const startProgressInterval = () => {
    clearProgressInterval();
    setUploadProgress(0);
    progressIntervalRef.current = setInterval(() => {
      setUploadProgress((prev) => (prev >= 90 ? prev : prev + 10));
    }, 200);
  };

  useEffect(() => () => clearProgressInterval(), []);

  // Check if compound is selected first - redirect if not
  // BUT: Service providers and moderators don't need compound_id and shouldn't be on this page
  useEffect(() => {
    if (userLoading) return; // Wait for user data to load
    if (!user) return; // Wait for user to load
    
    // Redirect service providers and moderators to their status pages (they don't use resident verification)
    if (user.role === 'SERVICE_PROVIDER') {
      router.replace('/provider/status');
      return;
    }
    
    if (user.role === 'COMPOUND_MOD') {
      router.replace('/moderator/status');
      return;
    }

    if (user.status === 'APPROVED' && isVerifiedForCurrentCompound(user)) {
      router.replace('/feed');
      return;
    }

    if (user.verification_status === 'PENDING') {
      router.replace('/verification/pending');
      return;
    }
    if (!user.compound_id) {
      router.push("/onboarding/compound-select");
      return;
    }
  }, [user, userLoading, router]);

  // Only fetch verification status if compound is selected
  // BUT: Service providers and moderators don't need compound_id, so skip verification status fetch for them
  const shouldFetchStatus = !!(user && user.compound_id && user.role !== 'SERVICE_PROVIDER' && user.role !== 'COMPOUND_MOD');

  // Fetch compound details to display name
  const { data: compound } = useQuery<{ id: number; name: string; area?: string }>({
    queryKey: ["compound", user?.compound_id],
    queryFn: async () => {
      if (!user?.compound_id) return null;
      // Fetch compounds list and find the one matching the user's compound_id
      const response = await api.get(`/api/compounds?limit=200`);
      const compounds = response.data.items || [];
      const foundCompound = compounds.find((c: any) => c.id === user.compound_id);
      return foundCompound || null;
    },
    enabled: shouldFetchStatus,
    retry: false,
  });

  const { data: status, refetch } = useQuery<VerificationStatus>({
    queryKey: ["verification-status"],
    queryFn: async () => {
      const response = await api.get("/api/verification/status");
      return response.data;
    },
    enabled: shouldFetchStatus,
    retry: false,
    refetchInterval: 5000, // Poll every 5 seconds to check for approval
  });

  // Refresh user data when verification status changes to APPROVED
  useEffect(() => {
    if (status?.user_status !== "APPROVED") return;
    queryClient.invalidateQueries({ queryKey: ["current-user"] });
    if (user && isVerifiedForCurrentCompound(user)) {
      router.replace("/feed");
    }
  }, [status?.user_status, user, queryClient, router]);

  // Clear pending uploads if documents are already submitted
  useEffect(() => {
    if (status?.national_id?.status) {
      setPendingNationalId(null);
    }
    if (status?.contract?.status) {
      setPendingContract(null);
    }
    const rejectedNationalId =
      status?.national_id?.status === "REJECTED" ||
      status?.national_id?.status === "REQUEST_MORE_DETAILS";
    const rejectedContract =
      status?.contract?.status === "REJECTED" ||
      status?.contract?.status === "REQUEST_MORE_DETAILS";
    setSelectedDocumentType((current) => {
      if (current) return current;
      if (rejectedNationalId) return "national_id";
      if (rejectedContract) return "contract";
      if (status?.national_id) return "national_id";
      if (status?.contract) return "contract";
      return null;
    });
    const pendingReview =
      status?.national_id?.status === "PENDING" || status?.contract?.status === "PENDING";
    const needsReupload =
      status?.national_id?.status === "REJECTED" ||
      status?.contract?.status === "REJECTED" ||
      status?.national_id?.status === "REQUEST_MORE_DETAILS" ||
      status?.contract?.status === "REQUEST_MORE_DETAILS";
    if (
      pendingReview &&
      !needsReupload &&
      status?.user_status !== "REJECTED" &&
      status?.user_status !== "APPROVED"
    ) {
      router.replace("/verification/pending");
    }
  }, [status, router]);

  const uploadDocument = async (
    type: DocumentType,
    file: File
  ) => {
    setUploading(type);
    startProgressInterval();

    try {
      // Get presigned URL
      const documentType = type === "national_id" ? "NATIONAL_ID" : "CONTRACT";
      const contentType = resolveUploadContentType(file);
      const presignResponse = await api.post("/api/verification/presign", {
        file_name: file.name,
        file_type: contentType,
        document_type: documentType,
      });

      const { presigned_url, file_url } = presignResponse.data;

      if (!presigned_url || !file_url) {
        throw new Error("Failed to get upload URL from server");
      }

      try {
        await uploadToPresignedUrl(presigned_url, file, contentType);
      } catch (fetchError: any) {
        throw new Error(`Failed to upload file: ${fetchError?.message || 'Network error'}`);
      }

      // Store the file URL then submit immediately (one-step verification)
      clearProgressInterval();
      setUploadProgress(100);
      if (type === "national_id") {
        setPendingNationalId(file_url);
      } else {
        setPendingContract(file_url);
      }

      setSubmitting(true);
      try {
        await api.post("/api/verification/submit", {
          file_url,
          document_type: documentType,
        });
        setPendingNationalId(null);
        setPendingContract(null);
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["current-user"] });
        toast({
          title: "Submitted for review",
          description: "Your document is under review. You'll get access once approved.",
          variant: "success",
        });
        router.replace("/verification/pending");
      } catch (submitError: any) {
        toast({
          title: "Uploaded — submit required",
          description:
            submitError?.response?.data?.detail ||
            "File uploaded. Tap Submit Document for Review to finish.",
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || "Upload failed. Please try again.";
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      clearProgressInterval();
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
    return "Uploaded — under review";
  };

  const getStatusBadgeClass = (docStatus: string | undefined) => {
    if (!docStatus) return "bg-gray-100 text-gray-700";
    if (docStatus === "APPROVED") return "bg-green-100 text-green-700 border-green-300";
    if (docStatus === "REJECTED") return "bg-red-100 text-red-700 border-red-300";
    return "bg-yellow-100 text-yellow-700 border-yellow-300";
  };

  // Early return: Don't render anything if user doesn't have compound selected
  // BUT: Skip for service providers and moderators (they don't need compound_id)
  // This prevents any API calls from being made
  if (!userLoading && user && !user.compound_id) {
    // Skip compound check for service providers and moderators
    if (user.role === 'SERVICE_PROVIDER' || user.role === 'COMPOUND_MOD') {
      // Service providers and moderators should be redirected to their status pages
      // This will be handled by the useEffect above or by other guards
      // For now, redirect service providers away from verification page
      if (user.role === 'SERVICE_PROVIDER') {
        router.replace('/provider/status');
        return null;
      }
      if (user.role === 'COMPOUND_MOD') {
        router.replace('/moderator/status');
        return null;
      }
    }
    // Redirect will happen in useEffect, but return early to prevent rendering
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Please select a compound first...</p>
        </div>
      </div>
    );
  }

  // Show loading while user data is being fetched
  if (userLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const nationalIdStatus = status?.national_id?.status;
  const contractStatus = status?.contract?.status;
  // Badge must reflect local pending upload OR saved API status
  const nationalIdDisplayStatus =
    nationalIdStatus || (pendingNationalId ? "PENDING" : undefined);
  const contractDisplayStatus =
    contractStatus || (pendingContract ? "PENDING" : undefined);
  const selectedStatus =
    selectedDocumentType === "national_id" ? nationalIdStatus : contractStatus;
  const selectedDisplayStatus =
    selectedDocumentType === "national_id"
      ? nationalIdDisplayStatus
      : selectedDocumentType === "contract"
        ? contractDisplayStatus
        : undefined;
  const selectedDocument =
    selectedDocumentType === "national_id"
      ? status?.national_id
      : selectedDocumentType === "contract"
        ? status?.contract
        : null;
  const selectedPendingUrl =
    selectedDocumentType === "national_id"
      ? pendingNationalId
      : selectedDocumentType === "contract"
        ? pendingContract
        : null;
  const canSubmit = !!selectedPendingUrl && !submitting;

  const submitDocument = async () => {
    if (!selectedDocumentType || !selectedPendingUrl) return;
    
    setSubmitting(true);
    try {
      await api.post("/api/verification/submit", {
        file_url: selectedPendingUrl,
        document_type: selectedDocumentType === "national_id" ? "NATIONAL_ID" : "CONTRACT",
      });
      setPendingNationalId(null);
      setPendingContract(null);
      
      // Refresh status + user so RoleGuard sees PENDING
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      
      toast({
        title: "Document submitted",
        description: "Your document is under review. You'll get access once approved.",
        variant: "success",
      });

      router.replace("/verification/pending");
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to submit document. Please try again.";
      toast({
        title: "Submission failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header with icon */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary mb-4 shadow-lg">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Resident Verification
          </h1>
          <VerificationCompoundBar
            currentCompoundName={status?.compound_name ?? compound?.name}
            currentCompoundArea={compound?.area}
            onCompoundChange={() => {
              setSelectedDocumentType(null)
              refetch()
              queryClient.invalidateQueries({ queryKey: ['current-user'] })
            }}
          />
          <p className="text-gray-600 text-lg mb-4">
            Upload <span className="font-semibold text-primary">one document</span> to get verified
          </p>
          <div className="max-w-2xl mx-auto bg-secondary border-2 border-border rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-white text-sm font-bold">!</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm text-primary text-center">
                  Upload <strong>National ID</strong> or <strong>Contract</strong> showing your name and compound name
                </p>
              </div>
            </div>
          </div>
        </div>

        <SignOutButton className="mx-auto max-w-md" />

        <Card className="shadow-xl border-2 border-gray-200 hover:shadow-2xl transition-shadow duration-300">
          <CardHeader className="bg-primary text-white rounded-t-lg">
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileCheck className="w-6 h-6" />
              Upload One Document
            </CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Only one document is needed. Choose whichever clearly shows your name and compound or neighbourhood.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800" htmlFor="document-type">
                Document type
              </label>
              <Select
                value={selectedDocumentType ?? undefined}
                onValueChange={(value: DocumentType) => setSelectedDocumentType(value)}
                disabled={!!uploading || submitting}
              >
                <SelectTrigger id="document-type" aria-label="Choose document type">
                  <SelectValue placeholder="Select a document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="national_id">National ID</SelectItem>
                  <SelectItem value="contract">Residency / Ownership contract</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600">
                Choose either National ID or residency / ownership contract—not both.
              </p>
            </div>

            {!selectedDocumentType && (
              <div className="rounded-xl border border-primary/20 bg-secondary p-4 text-center text-sm text-primary">
                Select the one document you want to use for verification.
              </div>
            )}

            {selectedDocumentType && (
              <div className={`border-2 rounded-xl p-6 transition-all duration-300 ${
                uploading === selectedDocumentType
                  ? "border-primary/40 bg-secondary shadow-lg scale-[1.02]"
                  : selectedStatus === "APPROVED"
                    ? "border-green-300 bg-green-50"
                    : "border-gray-200 bg-white hover:border-primary/30 hover:shadow-md"
              }`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedDisplayStatus === "APPROVED"
                        ? "bg-green-500"
                        : selectedDisplayStatus === "PENDING"
                          ? "bg-yellow-500"
                          : "bg-gray-300"
                    } transition-colors duration-300`}>
                      <FileCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">
                        {selectedDocumentType === "national_id"
                          ? "National ID"
                          : "Residency / Ownership contract"}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {selectedDocumentType === "national_id"
                          ? "Upload a clear image of your National ID."
                          : "Upload an image or PDF of your residency or ownership contract."}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Must clearly show your name and "{compound?.name || "your compound or neighbourhood"}"
                      </p>
                    </div>
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${getStatusBadgeClass(selectedDisplayStatus)} transition-all duration-300`}>
                  {getStatusIcon(selectedDisplayStatus)}
                  <span className="text-sm font-medium">
                    {getStatusText(selectedDisplayStatus)}
                  </span>
                </div>
              </div>

              {uploading === selectedDocumentType && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
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
                    uploadDocument(selectedDocumentType, file);
                  }
                  e.target.value = "";
                }}
                disabled={uploading === selectedDocumentType || selectedStatus === "APPROVED"}
                className="hidden"
                id="verification-document-upload"
              />
              {(selectedDocument || selectedPendingUrl) && (
                <div className="mb-4">
                  <UploadedDocumentCard
                    title={
                      selectedDocumentType === "national_id"
                        ? "National ID"
                        : "Residency / Ownership contract"
                    }
                    status={selectedDocument?.status || (selectedPendingUrl ? "PENDING" : undefined)}
                    fileUrl={selectedDocument?.file_url || selectedPendingUrl}
                  />
                </div>
              )}
              
              <label htmlFor="verification-document-upload">
                <Button
                  variant={selectedStatus === "APPROVED" ? "outline" : "default"}
                  disabled={uploading === selectedDocumentType || selectedStatus === "APPROVED"}
                  className={`w-full transition-all duration-200 ${
                    uploading === selectedDocumentType || selectedStatus === "APPROVED"
                      ? "opacity-75 cursor-not-allowed"
                      : "hover:scale-[1.02] hover:shadow-md"
                  }`}
                  asChild
                >
                  <span className="flex items-center justify-center">
                    {uploading === selectedDocumentType ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {selectedDocument || selectedPendingUrl
                          ? "Replace Document"
                          : "Upload Document"}
                      </>
                    )}
                  </span>
                </Button>
              </label>
              </div>
            )}

            {selectedPendingUrl && (
              <div className="pt-4 border-t-2 border-gray-200">
                <Button
                  onClick={submitDocument}
                  disabled={!canSubmit}
                  className="w-full bg-primary  text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting Document...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-5 h-5 mr-2" />
                      Submit Document for Review
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {selectedDocumentType === "national_id"
                    ? "National ID will be submitted for verification"
                    : "Contract will be submitted for verification"}
                </p>
                <p className="text-xs text-primary mt-1 text-center font-medium">
                  Make sure the document clearly shows your name and "{compound?.name || 'compound name'}"
                </p>
              </div>
            )}

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
