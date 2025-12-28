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
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>("ALL");
  const [compoundFilter, setCompoundFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("created_at_desc");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [groupByCompound, setGroupByCompound] = useState<boolean>(false);
  const [groupByUser, setGroupByUser] = useState<boolean>(false);
  const [previewDoc, setPreviewDoc] = useState<VerificationDocument | null>(
    null
  );
  const [bulkVerifying, setBulkVerifying] = useState<boolean>(false);

  // Build query parameters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.append("status_filter", statusFilter);
    if (documentTypeFilter !== "ALL") params.append("document_type", documentTypeFilter);
    if (compoundFilter !== "ALL") params.append("compound_id", compoundFilter);
    if (searchQuery) params.append("search", searchQuery);
    params.append("sort_by", sortBy);
    params.append("skip", String((page - 1) * pageSize));
    params.append("limit", String(pageSize));
    return params.toString();
  };

  const {
    data: documentsData,
    isLoading,
    refetch,
  } = useQuery<{ items: VerificationDocument[]; total: number; skip: number; limit: number }>({
    queryKey: ["admin-verifications", statusFilter, documentTypeFilter, compoundFilter, searchQuery, sortBy, page, pageSize],
    queryFn: async () => {
      const url = `/api/admin/verifications?${buildQueryParams()}`;
      const response = await api.get(url);
      return response.data;
    },
  });

  const documents = documentsData?.items || [];
  const totalDocuments = documentsData?.total || 0;
  const totalPages = Math.ceil(totalDocuments / pageSize);

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

  const bulkVerifyMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams();
      params.append("status_filter", "PENDING");
      params.append("limit", "100");
      const response = await api.post(
        `/api/admin/verifications/bulk-verify-with-llm?${params.toString()}`
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Verification Complete! 🤖",
        description: `Processed ${data.total_processed} documents. ${data.successful} successful, ${data.failed} failed.`,
        variant: "success",
      });
      refetch();
      setBulkVerifying(false);
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Verification Failed",
        description: error?.response?.data?.detail || "Please try again.",
        variant: "destructive",
      });
      setBulkVerifying(false);
    },
  });

  const handleBulkVerify = () => {
    if (window.confirm(`This will verify all PENDING documents with AI (up to 100). Continue?`)) {
      setBulkVerifying(true);
      bulkVerifyMutation.mutate();
    }
  };

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

        {/* Search, Filters, Sort, and Bulk Actions */}
        <Card className="shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="flex gap-4 items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Search by user name, email, or notes..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1); // Reset to first page on search
                    }}
                    className="pl-10"
                  />
                </div>
                <Button
                  onClick={handleBulkVerify}
                  disabled={bulkVerifying || statusFilter !== "PENDING"}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  {bulkVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Verify All Pending with AI
                    </>
                  )}
                </Button>
              </div>

              {/* Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Status Filter */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Status</Label>
                  <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                      <SelectItem value="REQUEST_MORE_DETAILS">More Details</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Document Type Filter */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Document Type</Label>
                  <Select value={documentTypeFilter} onValueChange={(value) => { setDocumentTypeFilter(value); setPage(1); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="NATIONAL_ID">National ID</SelectItem>
                      <SelectItem value="CONTRACT">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Sort By</Label>
                  <Select value={sortBy} onValueChange={(value) => { setSortBy(value); setPage(1); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at_desc">Newest First</SelectItem>
                      <SelectItem value="created_at_asc">Oldest First</SelectItem>
                      <SelectItem value="user_name_asc">User Name (A-Z)</SelectItem>
                      <SelectItem value="user_name_desc">User Name (Z-A)</SelectItem>
                      <SelectItem value="status_asc">Status (A-Z)</SelectItem>
                      <SelectItem value="status_desc">Status (Z-A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Page Size */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Per Page</Label>
                  <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Group By Toggles */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant={groupByCompound ? "default" : "outline"}
                  onClick={() => {
                    setGroupByCompound(!groupByCompound);
                    if (!groupByCompound) setGroupByUser(false);
                  }}
                  className={groupByCompound ? "bg-purple-600 hover:bg-purple-700" : ""}
                  size="sm"
                >
                  <Home className="w-4 h-4 mr-2" />
                  {groupByCompound ? "Ungroup" : "Group by Compound"}
                </Button>
                <Button
                  variant={groupByUser ? "default" : "outline"}
                  onClick={() => {
                    setGroupByUser(!groupByUser);
                    if (!groupByUser) setGroupByCompound(false);
                  }}
                  className={groupByUser ? "bg-blue-600 hover:bg-blue-700" : ""}
                  size="sm"
                >
                  <User className="w-4 h-4 mr-2" />
                  {groupByUser ? "Ungroup" : "Group by User"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold">{documents.length}</span> of{" "}
            <span className="font-semibold">{totalDocuments}</span> documents
          </p>
        </div>

        {/* Filters and Grouping */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Status Filter Tabs (Quick Access) */}
          <div className="flex flex-wrap gap-2 flex-1">
            <Button
              variant={statusFilter === "ALL" ? "default" : "outline"}
              onClick={() => { setStatusFilter("ALL"); setPage(1); }}
              className={statusFilter === "ALL" ? "bg-blue-600 hover:bg-blue-700" : ""}
              size="sm"
            >
              All ({totalDocuments})
            </Button>
            <Button
              variant={statusFilter === "PENDING" ? "default" : "outline"}
              onClick={() => { setStatusFilter("PENDING"); setPage(1); }}
              className={statusFilter === "PENDING" ? "bg-yellow-600 hover:bg-yellow-700" : ""}
              size="sm"
            >
              Pending
            </Button>
            <Button
              variant={statusFilter === "APPROVED" ? "default" : "outline"}
              onClick={() => { setStatusFilter("APPROVED"); setPage(1); }}
              className={statusFilter === "APPROVED" ? "bg-green-600 hover:bg-green-700" : ""}
              size="sm"
            >
              Approved
            </Button>
            <Button
              variant={statusFilter === "REJECTED" ? "default" : "outline"}
              onClick={() => { setStatusFilter("REJECTED"); setPage(1); }}
              className={statusFilter === "REJECTED" ? "bg-red-600 hover:bg-red-700" : ""}
              size="sm"
            >
              Rejected
            </Button>
            <Button
              variant={statusFilter === "REQUEST_MORE_DETAILS" ? "default" : "outline"}
              onClick={() => { setStatusFilter("REQUEST_MORE_DETAILS"); setPage(1); }}
              className={statusFilter === "REQUEST_MORE_DETAILS" ? "bg-orange-600 hover:bg-orange-700" : ""}
              size="sm"
            >
              More Details
            </Button>
          </div>
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
            // Render document card component - Define first so it can be used in grouping
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

                      {/* LLM Results - Structured Display */}
                      {doc.llm_verified_at && (
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-l-purple-500 rounded-r-lg p-4">
                          <div className="flex items-start gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="font-semibold text-purple-900 mb-2 text-sm">
                                AI Verification Results
                              </div>
                              
                              {/* Confidence Display */}
                              {doc.llm_confidence !== undefined && doc.llm_confidence !== null && (
                                <div className="mb-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-purple-700">Confidence:</span>
                                    <span className={`text-sm font-bold ${
                                      doc.llm_confidence >= 0.8 
                                        ? "text-green-600" 
                                        : doc.llm_confidence >= 0.5 
                                        ? "text-yellow-600" 
                                        : "text-red-600"
                                    }`}>
                                      {Math.round(doc.llm_confidence * 100)}%
                                    </span>
                                    {doc.llm_confidence >= 0.8 && (
                                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                        Auto-Selected
                                      </span>
                                    )}
                                  </div>
                                  {/* Confidence bar */}
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full transition-all ${
                                        doc.llm_confidence >= 0.8 
                                          ? "bg-green-500" 
                                          : doc.llm_confidence >= 0.5 
                                          ? "bg-yellow-500" 
                                          : "bg-red-500"
                                      }`}
                                      style={{ width: `${doc.llm_confidence * 100}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Name Match */}
                              {doc.llm_extracted_info?.name_match && (
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-600 w-20">Name:</span>
                                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                    doc.llm_extracted_info.name_match === "MATCH"
                                      ? "bg-green-100 text-green-700"
                                      : doc.llm_extracted_info.name_match === "NO_MATCH"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-yellow-100 text-yellow-700"
                                  }`}>
                                    {doc.llm_extracted_info.name_match === "MATCH" ? "✓ MATCH" :
                                     doc.llm_extracted_info.name_match === "NO_MATCH" ? "✗ NO MATCH" :
                                     "? UNCLEAR"}
                                  </span>
                                </div>
                              )}

                              {/* Address Match */}
                              {doc.llm_extracted_info?.address_match && doc.llm_extracted_info.address_match !== "N/A" && (
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-600 w-20">Address:</span>
                                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                    doc.llm_extracted_info.address_match === "MATCH"
                                      ? "bg-green-100 text-green-700"
                                      : doc.llm_extracted_info.address_match === "NO_MATCH"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-yellow-100 text-yellow-700"
                                  }`}>
                                    {doc.llm_extracted_info.address_match === "MATCH" ? "✓ MATCH" :
                                     doc.llm_extracted_info.address_match === "NO_MATCH" ? "✗ NO MATCH" :
                                     "? UNCLEAR"}
                                  </span>
                                </div>
                              )}

                              {/* Recommendation */}
                              {doc.llm_recommendation && (
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-600 w-20">Status:</span>
                                  {getLLMRecommendationBadge(doc.llm_recommendation)}
                                </div>
                              )}

                              {/* Reasoning */}
                              {doc.llm_reasoning && (
                                <div className="mt-3 pt-3 border-t border-purple-200">
                                  <p className="text-xs text-purple-600 line-clamp-3">
                                    {doc.llm_reasoning}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {doc.notes && (
                        <div className="bg-yellow-50 border-l-4 border-l-yellow-400 rounded-r-lg p-3">
                          <p className="text-sm text-yellow-900">
                            <strong>Notes:</strong> {doc.notes}
                          </p>
                        </div>
                      )}

                      {/* File Preview */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewDoc(doc)}
                          className="text-sm"
                        >
                          <Eye className="w-4 h-4 mr-2" />
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
                          {/* Always show Verify with AI button - allows retry even after successful verification */}
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
                                {doc.llm_verified_at ? "Verify with AI (Retry)" : "Verify with AI"}
                              </>
                            )}
                          </Button>
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

            // Group documents by compound if enabled
            const groupedByCompound =
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

            // Group documents by user if enabled
            const groupedByUser =
              groupByUser && documents
                ? documents.reduce((acc, doc) => {
                    const userKey = doc.user
                      ? `${doc.user.name} (${doc.user.email})`
                      : `User ${doc.user_id}`;
                    if (!acc[userKey]) {
                      acc[userKey] = [];
                    }
                    acc[userKey].push(doc);
                    return acc;
                  }, {} as Record<string, VerificationDocument[]>)
                : null;

            // Render grouped by compound
            if (groupedByCompound) {
              return (
                <div className="space-y-6">
                  {Object.entries(groupedByCompound).map(
                    ([compoundName, docs]) => (
                      <div
                        key={compoundName}
                        className="bg-white rounded-lg shadow-md p-6 border-l-4 border-l-purple-500"
                      >
                        <div className="flex items-center justify-between mb-4 pb-4 border-b">
                          <div className="flex items-center gap-3">
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
                    )
                  )}
                </div>
              );
            }

            // Render grouped by user
            if (groupedByUser) {
              return (
                <div className="space-y-6">
                  {Object.entries(groupedByUser).map(([userKey, docs]) => {
                    const firstDoc = docs[0];
                    return (
                      <div
                        key={userKey}
                        className="bg-white rounded-lg shadow-md p-6 border-l-4 border-l-blue-500"
                      >
                        <div className="flex items-center justify-between mb-4 pb-4 border-b">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                              <User className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <h2 className="text-lg font-semibold text-gray-900">
                                {firstDoc.user?.name || `User ${firstDoc.user_id}`}
                              </h2>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                <span>{firstDoc.user?.email}</span>
                                {firstDoc.user?.phone && (
                                  <span>• {firstDoc.user.phone}</span>
                                )}
                                {firstDoc.user?.compound_name && (
                                  <span className="text-blue-600">
                                    • {firstDoc.user.compound_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                            {docs.length} document{docs.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Documents for this user */}
                        <div className="space-y-4 pl-2">
                          {docs.map((doc) => renderDocumentCard(doc))}
                        </div>
                      </div>
                    );
                  })}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page <span className="font-semibold">{page}</span> of{" "}
                  <span className="font-semibold">{totalPages}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    size="sm"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "outline"}
                          onClick={() => setPage(pageNum)}
                          size="sm"
                          className={page === pageNum ? "bg-blue-600 hover:bg-blue-700" : ""}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    size="sm"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
