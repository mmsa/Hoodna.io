"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  User,
  Mail,
  Phone,
  Sparkles,
  Loader2,
  MessageSquare,
  Home,
  Grid3x3,
  Eye,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VerificationDocument {
  id: number;
  user_id: number;
  type: string;
  file_url: string;
  status: string;
  reviewer_id?: number;
  notes?: string;
  llm_verified?: boolean;
  llm_confidence?: number;
  llm_recommendation?: string;
  llm_reasoning?: string;
  llm_issues?: string[];
  llm_extracted_info?: Record<string, any>;
  llm_verified_at?: string;
  created_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    compound_id?: number;
    compound_name?: string;
    compound_area?: string;
  };
}

export default function AdminVerificationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDoc, setSelectedDoc] = useState<VerificationDocument | null>(
    null
  );
  const [requestMoreDialogOpen, setRequestMoreDialogOpen] = useState(false);
  const [requestMoreNotes, setRequestMoreNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [groupByCompound, setGroupByCompound] = useState<boolean>(false);
  const [previewDoc, setPreviewDoc] = useState<VerificationDocument | null>(
    null
  );

  const {
    data: documents,
    isLoading,
    refetch,
  } = useQuery<VerificationDocument[]>({
    queryKey: ["admin-verifications", statusFilter],
    queryFn: async () => {
      const url =
        statusFilter === "ALL"
          ? "/api/admin/verifications"
          : `/api/admin/verifications?status_filter=${statusFilter}`;
      const response = await api.get(url);
      return response.data;
    },
  });

  const llmVerifyMutation = useMutation({
    mutationFn: async (docId: number) => {
      const response = await api.post(
        `/api/admin/verifications/${docId}/verify-with-llm`
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: "LLM Verification Complete! 🤖",
        description: `Recommendation: ${data.llm_result.recommendation}`,
        variant: "success",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "LLM Verification Failed",
        description: error?.response?.data?.detail || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (docId: number) => {
      const response = await api.post(
        `/api/admin/verifications/${docId}/approve`,
        {}
      );
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Document Approved! ✅",
        description: "The document has been approved.",
        variant: "success",
      });
      refetch();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (docId: number) => {
      const response = await api.post(
        `/api/admin/verifications/${docId}/reject`,
        {}
      );
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Document Rejected",
        description: "The document has been rejected.",
        variant: "default",
      });
      refetch();
    },
  });

  const requestMoreMutation = useMutation({
    mutationFn: async ({ docId, notes }: { docId: number; notes?: string }) => {
      const response = await api.post(
        `/api/admin/verifications/${docId}/request-more-details`,
        { notes }
      );
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "More Details Requested",
        description: "The user will be notified to provide more information.",
        variant: "default",
      });
      setRequestMoreDialogOpen(false);
      setSelectedDoc(null);
      setRequestMoreNotes("");
      refetch();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      docId,
      status,
      notes,
    }: {
      docId: number;
      status: string;
      notes?: string;
    }) => {
      const response = await api.patch(
        `/api/admin/verifications/${docId}/status`,
        {
          status,
          notes,
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Status Updated",
        description: `Document status changed to ${data.status}`,
        variant: "success",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Status Update Failed",
        description: error?.response?.data?.detail || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRequestMore = (doc: VerificationDocument) => {
    setSelectedDoc(doc);
    setRequestMoreNotes("");
    setRequestMoreDialogOpen(true);
  };

  const submitRequestMore = () => {
    if (!selectedDoc) return;
    const notes = requestMoreNotes.trim() || undefined;
    requestMoreMutation.mutate({ docId: selectedDoc.id, notes });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            Rejected
          </span>
        );
      case "REQUEST_MORE_DETAILS":
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            More Details Needed
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            Pending
          </span>
        );
    }
  };

  const getLLMRecommendationBadge = (recommendation?: string) => {
    if (!recommendation) return null;

    switch (recommendation) {
      case "APPROVE":
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            LLM: Approve
          </span>
        );
      case "REJECT":
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            LLM: Reject
          </span>
        );
      case "REQUEST_MORE_DETAILS":
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            LLM: More Details
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading verifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Document Verification
          </h1>
          <p className="text-gray-600">Review and verify user documents</p>
        </div>

        {/* Filters and Grouping */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap gap-2 flex-1">
            <Button
              variant={statusFilter === "ALL" ? "default" : "outline"}
              onClick={() => setStatusFilter("ALL")}
              className={
                statusFilter === "ALL" ? "bg-blue-600 hover:bg-blue-700" : ""
              }
            >
              All Documents ({documents?.length || 0})
            </Button>
            <Button
              variant={statusFilter === "PENDING" ? "default" : "outline"}
              onClick={() => setStatusFilter("PENDING")}
              className={
                statusFilter === "PENDING"
                  ? "bg-yellow-600 hover:bg-yellow-700"
                  : ""
              }
            >
              Pending
            </Button>
            <Button
              variant={statusFilter === "APPROVED" ? "default" : "outline"}
              onClick={() => setStatusFilter("APPROVED")}
              className={
                statusFilter === "APPROVED"
                  ? "bg-green-600 hover:bg-green-700"
                  : ""
              }
            >
              Approved
            </Button>
            <Button
              variant={statusFilter === "REJECTED" ? "default" : "outline"}
              onClick={() => setStatusFilter("REJECTED")}
              className={
                statusFilter === "REJECTED" ? "bg-red-600 hover:bg-red-700" : ""
              }
            >
              Rejected
            </Button>
            <Button
              variant={
                statusFilter === "REQUEST_MORE_DETAILS" ? "default" : "outline"
              }
              onClick={() => setStatusFilter("REQUEST_MORE_DETAILS")}
              className={
                statusFilter === "REQUEST_MORE_DETAILS"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : ""
              }
            >
              More Details Requested
            </Button>
          </div>

          {/* Group By Compound Toggle */}
          <Button
            variant={groupByCompound ? "default" : "outline"}
            onClick={() => setGroupByCompound(!groupByCompound)}
            className={
              groupByCompound ? "bg-purple-600 hover:bg-purple-700" : ""
            }
          >
            <Grid3x3 className="w-4 h-4 mr-2" />
            {groupByCompound ? "Ungroup" : "Group by Compound"}
          </Button>
        </div>

        {/* Documents List */}
        {documents && documents.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                All caught up!
              </h3>
              <p className="text-gray-500">
                No documents found for the selected filter.
              </p>
            </CardContent>
          </Card>
        ) : (
          (() => {
            // Group documents by compound if enabled
            const groupedDocs =
              groupByCompound && documents
                ? documents.reduce((acc, doc) => {
                    const compoundKey =
                      doc.user?.compound_name || "No Compound";
                    if (!acc[compoundKey]) {
                      acc[compoundKey] = [];
                    }
                    acc[compoundKey].push(doc);
                    return acc;
                  }, {} as Record<string, VerificationDocument[]>)
                : null;

            // Render document card component
            const renderDocumentCard = (doc: VerificationDocument) => (
              <Card
                key={doc.id}
                className="shadow-md hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left Column - Main Info */}
                    <div className="flex-1 space-y-4">
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {doc.type === "NATIONAL_ID"
                                  ? "National ID"
                                  : "Residency/Ownership Contract"}
                              </h3>
                              <p className="text-sm text-gray-500 mt-0.5">
                                Submitted{" "}
                                {new Date(doc.created_at).toLocaleDateString()}{" "}
                                at{" "}
                                {new Date(doc.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {getStatusBadge(doc.status)}
                            {getLLMRecommendationBadge(doc.llm_recommendation)}
                          </div>
                        </div>
                      </div>

                      {/* User Info - Compact with Compound */}
                      {doc.user && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 text-sm flex-wrap">
                            <div className="flex items-center gap-2 text-gray-600">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">
                                {doc.user.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <span>{doc.user.email}</span>
                            </div>
                            {doc.user.phone && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <Phone className="w-4 h-4 text-gray-400" />
                                <span>{doc.user.phone}</span>
                              </div>
                            )}
                          </div>
                          {/* Compound Info */}
                          {doc.user.compound_name && (
                            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md w-fit">
                              <Home className="w-4 h-4" />
                              <span className="font-medium">
                                {doc.user.compound_name}
                              </span>
                              {doc.user.compound_area && (
                                <span className="text-gray-500">
                                  • {doc.user.compound_area}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* LLM Results - Compact */}
                      {doc.llm_verified_at && (
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-l-purple-500 rounded-r-lg p-3">
                          <div className="flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-purple-900">
                                  AI Verification
                                </span>
                                {doc.llm_confidence !== undefined && (
                                  <span className="text-xs text-gray-600">
                                    ({Math.round(doc.llm_confidence * 100)}%
                                    confidence)
                                  </span>
                                )}
                              </div>
                              {doc.llm_reasoning && (
                                <p className="text-xs text-gray-700 line-clamp-2">
                                  {doc.llm_reasoning}
                                </p>
                              )}
                              {doc.llm_issues && doc.llm_issues.length > 0 && (
                                <div className="mt-1">
                                  <span className="text-xs font-medium text-red-700">
                                    Issues:{" "}
                                  </span>
                                  <span className="text-xs text-gray-600">
                                    {doc.llm_issues.join(", ")}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Notes if exists */}
                      {doc.notes && (
                        <div className="bg-yellow-50 border-l-4 border-l-yellow-500 rounded-r-lg p-3">
                          <p className="text-xs font-medium text-yellow-900 mb-1">
                            Admin Notes:
                          </p>
                          <p className="text-xs text-yellow-800">{doc.notes}</p>
                        </div>
                      )}

                      {/* Document Preview Button */}
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewDoc(doc)}
                          className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200"
                        >
                          <Eye className="w-4 h-4" />
                          Preview Document
                        </Button>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                          Open in new tab
                        </a>
                      </div>
                    </div>

                    {/* Right Column - Actions */}
                    <div className="lg:w-64 flex-shrink-0 space-y-3">
                      {/* Status Change Dropdown */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">
                          Change Status
                        </label>
                        <Select
                          value={doc.status}
                          onValueChange={(newStatus: string) => {
                            updateStatusMutation.mutate({
                              docId: doc.id,
                              status: newStatus,
                            });
                          }}
                          disabled={updateStatusMutation.isPending}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="APPROVED">Approved</SelectItem>
                            <SelectItem value="REJECTED">Rejected</SelectItem>
                            <SelectItem value="REQUEST_MORE_DETAILS">
                              Request More Details
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quick Actions for PENDING documents */}
                      {doc.status === "PENDING" && (
                        <div className="space-y-2 pt-2 border-t">
                          {!doc.llm_verified_at && (
                            <Button
                              variant="outline"
                              onClick={() => llmVerifyMutation.mutate(doc.id)}
                              disabled={llmVerifyMutation.isPending}
                              className="w-full justify-start"
                              size="sm"
                            >
                              {llmVerifyMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Verifying...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Verify with AI
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="default"
                            onClick={() => approveMutation.mutate(doc.id)}
                            disabled={approveMutation.isPending}
                            className="w-full bg-green-600 hover:bg-green-700"
                            size="sm"
                          >
                            {approveMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Approving...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Quick Approve
                              </>
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => rejectMutation.mutate(doc.id)}
                            disabled={rejectMutation.isPending}
                            className="w-full"
                            size="sm"
                          >
                            {rejectMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Rejecting...
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 mr-2" />
                                Quick Reject
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleRequestMore(doc)}
                            disabled={requestMoreMutation.isPending}
                            className="w-full"
                            size="sm"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Request More Details
                          </Button>
                        </div>
                      )}

                      {/* Status Info for non-pending */}
                      {doc.status !== "PENDING" && (
                        <div className="text-center py-2 pt-2 border-t">
                          <p className="text-xs text-gray-500 mb-1">
                            Current Status
                          </p>
                          {getStatusBadge(doc.status)}
                          {doc.reviewer_id && (
                            <p className="text-xs text-gray-400 mt-2">
                              Reviewed by Admin
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );

            // If grouping, render grouped; otherwise render flat list
            if (groupedDocs) {
              return (
                <div className="space-y-6">
                  {Object.entries(groupedDocs)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([compoundName, docs]) => (
                      <div key={compoundName} className="space-y-4">
                        {/* Compound Header */}
                        <div className="flex items-center gap-3 pb-3 border-b-2 border-gray-300 bg-white rounded-lg p-4 shadow-sm">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <Home className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h2 className="text-lg font-semibold text-gray-900">
                              {compoundName}
                            </h2>
                            {docs[0]?.user?.compound_area && (
                              <p className="text-sm text-gray-500">
                                {docs[0].user.compound_area}
                              </p>
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                            {docs.length} document{docs.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Documents in this compound */}
                        <div className="space-y-4 pl-2">
                          {docs.map((doc) => renderDocumentCard(doc))}
                        </div>
                      </div>
                    ))}
                </div>
              );
            }

            // Flat list (no grouping)
            return (
              <div className="space-y-4">
                {documents?.map((doc) => renderDocumentCard(doc))}
              </div>
            );
          })()
        )}

        {/* Request More Details Dialog */}
        <Dialog
          open={requestMoreDialogOpen}
          onOpenChange={setRequestMoreDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request More Details</DialogTitle>
              <DialogDescription>
                Please provide details about what additional information is
                needed from the user.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="request-more-notes">Details Required</Label>
                <Textarea
                  id="request-more-notes"
                  placeholder="Please specify what additional information or documents are needed..."
                  value={requestMoreNotes}
                  onChange={(e) => setRequestMoreNotes(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRequestMoreDialogOpen(false);
                    setRequestMoreNotes("");
                    setSelectedDoc(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitRequestMore}
                  disabled={requestMoreMutation.isPending}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  {requestMoreMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Request"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Document Preview Dialog */}
        <Dialog
          open={!!previewDoc}
          onOpenChange={(open) => !open && setPreviewDoc(null)}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>
                    {previewDoc?.type === "NATIONAL_ID"
                      ? "National ID"
                      : "Residency/Ownership Contract"}
                  </DialogTitle>
                  <DialogDescription>
                    {previewDoc?.user?.name} •{" "}
                    {previewDoc?.user?.compound_name || "No Compound"}
                  </DialogDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewDoc(null)}
                  className="h-6 w-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-auto bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[400px]">
              {previewDoc?.file_url && (
                <div className="w-full h-full flex items-center justify-center">
                  {previewDoc.file_url.toLowerCase().endsWith(".pdf") ? (
                    <iframe
                      src={previewDoc.file_url}
                      className="w-full h-full min-h-[500px] rounded-lg border"
                      title="Document Preview"
                    />
                  ) : (
                    <img
                      src={previewDoc.file_url}
                      alt={previewDoc.type}
                      className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        const errorDiv = document.createElement("div");
                        errorDiv.className = "text-center p-8";
                        errorDiv.innerHTML = `
                          <p class="text-gray-500 mb-4">Unable to load image preview</p>
                          <a href="${previewDoc.file_url}" target="_blank" class="text-blue-600 hover:underline">
                            Open in new tab
                          </a>
                        `;
                        target.parentElement?.appendChild(errorDiv);
                      }}
                    />
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  if (previewDoc?.file_url) {
                    window.open(previewDoc.file_url, "_blank");
                  }
                }}
              >
                <Eye className="w-4 h-4 mr-2" />
                Open in New Tab
              </Button>
              <Button onClick={() => setPreviewDoc(null)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
