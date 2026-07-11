import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { DocumentType, VerificationStatusResponse } from "@hoodna/shared";
import { Ionicons } from "@expo/vector-icons";
import { normalizeFileUrl, isImageUrl, openFileUrl } from "@/lib/file-url";

export default function VerificationScreen() {
  const { apiClient, user, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<VerificationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [pendingNationalId, setPendingNationalId] = useState<string | null>(null);
  const [pendingContract, setPendingContract] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.compound_id) {
      router.replace("/onboarding/compound-select");
      return;
    }
    if (user.status === "APPROVED") {
      router.replace("/(tabs)/home");
      return;
    }
    // Already submitted (or rejected with prior docs) → status page
    if (
      user.verification_status === "PENDING" ||
      (user.status === "REJECTED" && user.verification_status === "REJECTED")
    ) {
      // Allow REJECTED users who need to re-upload to stay if they navigated here intentionally
      if (user.verification_status === "PENDING") {
        router.replace("/verification-pending");
        return;
      }
    }
    loadStatus();
  }, [user]);

  async function loadStatus() {
    try {
      const data = await apiClient.getVerificationStatus();
      setStatus(data);
      if (data.national_id?.status) {
        setPendingNationalId(null);
      }
      if (data.contract?.status) {
        setPendingContract(null);
      }
      // Already under review → status page (rejected users stay to re-upload)
      const pendingReview =
        data.national_id?.status === "PENDING" || data.contract?.status === "PENDING";
      if (pendingReview && data.user_status !== "REJECTED") {
        router.replace("/verification-pending");
        return;
      }
    } catch (error) {
      console.error("Failed to load verification status:", error);
    } finally {
      setLoading(false);
    }
  }

  async function pickDocument(type: DocumentType) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      await uploadDocument(type, file.uri, file.mimeType || "image/jpeg", file.name);
    } catch (error) {
      Alert.alert("Error", "Failed to pick document");
    }
  }

  async function pickImage(type: DocumentType) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const fileName = asset.uri.split("/").pop() || `image.jpg`;
      await uploadDocument(type, asset.uri, asset.mimeType || "image/jpeg", fileName);
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  }

  async function uploadDocument(
    type: DocumentType,
    fileUri: string,
    mimeType: string,
    fileName: string
  ) {
    setUploading(type);
    try {
      // Get presigned URL
      const presignResponse = await apiClient.getPresignedUrl({
        file_name: fileName,
        file_type: mimeType,
        document_type: type,
      });

      // Read file
      const response = await fetch(fileUri);
      const blob = await response.blob();

      // Check if this is a local storage upload
      const isLocalStorage = presignResponse.presigned_url.includes('/api/uploads/upload');
      
      let uploadResponse: Response;
      if (isLocalStorage) {
        // Local storage: use FormData
        const formData = new FormData();
        formData.append('file', blob as any);
        const urlParams = new URL(presignResponse.presigned_url).searchParams;
        const filePath = urlParams.get('file_path');
        if (filePath) {
          formData.append('file_path', filePath);
        }
        uploadResponse = await fetch(presignResponse.presigned_url, {
          method: "POST",
          body: formData,
        });
      } else {
        // S3: use PUT
        uploadResponse = await fetch(presignResponse.presigned_url, {
          method: "PUT",
          body: blob,
          headers: {
            "Content-Type": mimeType,
          },
        });
      }

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const fileUrl = presignResponse.file_url;
      if (type === "NATIONAL_ID") {
        setPendingNationalId(fileUrl);
      } else {
        setPendingContract(fileUrl);
      }

      // Submit immediately after upload
      setSubmitting(true);
      try {
        await apiClient.submitDocument({
          file_url: fileUrl,
          document_type: type,
        });
        setPendingNationalId(null);
        setPendingContract(null);
        await refreshUser();
        Alert.alert(
          "Submitted",
          "Document submitted for review. You'll get access once approved.",
          [{ text: "OK", onPress: () => router.replace("/verification-pending") }]
        );
      } catch (submitError: any) {
        Alert.alert(
          "Uploaded",
          submitError.message ||
            "File uploaded. Tap Submit Documents for Review to finish."
        );
      } finally {
        setSubmitting(false);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to upload document");
    } finally {
      setUploading(null);
    }
  }

  async function submitDocuments() {
    if (!pendingNationalId && !pendingContract) return;

    setSubmitting(true);
    try {
      const submissions = [];
      
      if (pendingNationalId) {
        submissions.push(
          apiClient.submitDocument({
            file_url: pendingNationalId,
            document_type: "NATIONAL_ID",
          })
        );
      }
      
      if (pendingContract) {
        submissions.push(
          apiClient.submitDocument({
            file_url: pendingContract,
            document_type: "CONTRACT",
          })
        );
      }
      
      await Promise.all(submissions);
      
      setPendingNationalId(null);
      setPendingContract(null);
      await refreshUser();
      await loadStatus();

      Alert.alert(
        "Submitted",
        "Documents submitted for review. You'll get access once approved.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/verification-pending"),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit documents");
    } finally {
      setSubmitting(false);
    }
  }

  function getStatusIcon(docStatus: string | undefined) {
    if (!docStatus) return "⏳";
    if (docStatus === "APPROVED") return "✅";
    if (docStatus === "REJECTED") return "❌";
    return "⏳";
  }

  function getStatusText(docStatus: string | undefined) {
    if (!docStatus) return "Not uploaded";
    if (docStatus === "APPROVED") return "Approved";
    if (docStatus === "REJECTED") return "Rejected";
    return "Uploaded — under review";
  }

  function getStatusColor(docStatus: string | undefined) {
    if (!docStatus) return "#9CA3AF";
    if (docStatus === "APPROVED") return "#10B981";
    if (docStatus === "REJECTED") return "#EF4444";
    return "#F59E0B";
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 16, color: "#6C757D" }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const nationalIdStatus = status?.national_id?.status;
  const contractStatus = status?.contract?.status;
  const hasPendingUploads = pendingNationalId || pendingContract;
  const canSubmit = hasPendingUploads && !submitting;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF" }} edges={["top"]}>
      {/* Header — no back into the app until verified */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827" }}>Verification</Text>
        <TouchableOpacity
          onPress={async () => {
            await logout();
            router.replace("/auth");
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#6B7280" }}>Log out</Text>
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 24, paddingVertical: 32 }}>
          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#3B82F6",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="shield-checkmark" size={32} color="#FFFFFF" />
            </View>
            <Text style={{ fontSize: 28, fontWeight: "bold", color: "#111827", marginBottom: 8 }}>
              Verification Documents
            </Text>
            <Text style={{ fontSize: 16, color: "#6B7280", textAlign: "center", marginTop: 8 }}>
              Upload <Text style={{ fontWeight: "600", color: "#3B82F6" }}>one document</Text> and submit to continue
            </Text>
          </View>

          {/* Info Box */}
          <View
            style={{
              backgroundColor: "#DBEAFE",
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
              borderWidth: 2,
              borderColor: "#93C5FD",
            }}
          >
            <Text style={{ fontSize: 14, color: "#1E40AF", textAlign: "center" }}>
              Upload <Text style={{ fontWeight: "600" }}>National ID</Text> or <Text style={{ fontWeight: "600" }}>Contract</Text> showing your name and compound name
            </Text>
          </View>

          {/* National ID Card */}
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 24 }}>🆔</Text>
                <Text style={{ fontSize: 18, fontWeight: "600", color: "#111827" }}>
                  National ID
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: `${getStatusColor(nationalIdStatus)}15`,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: getStatusColor(nationalIdStatus),
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: getStatusColor(nationalIdStatus) }}>
                  {getStatusIcon(nationalIdStatus)} {getStatusText(nationalIdStatus)}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 14, color: "#6B7280", marginBottom: 16 }}>
              Upload a clear photo of your national ID
            </Text>
            {(status?.national_id?.file_url || pendingNationalId) && (
              <View style={{ marginBottom: 12 }}>
                {isImageUrl(normalizeFileUrl(status?.national_id?.file_url || pendingNationalId)) ? (
                  <Image
                    source={{ uri: normalizeFileUrl(status?.national_id?.file_url || pendingNationalId) }}
                    style={{ width: "100%", height: 200, borderRadius: 12, backgroundColor: "#F3F4F6" }}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 6 }}>Document on file</Text>
                )}
                <TouchableOpacity onPress={() => openFileUrl(status?.national_id?.file_url || pendingNationalId, apiClient)}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#2563EB", marginTop: 8 }}>
                    View uploaded file
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: "#3B82F6",
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
                onPress={() => pickImage("NATIONAL_ID")}
                disabled={uploading === "NATIONAL_ID" || nationalIdStatus === "APPROVED"}
              >
                {uploading === "NATIONAL_ID" ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
                    {nationalIdStatus === "APPROVED" ? "✓ Approved" : "Upload National ID"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Contract Card */}
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 20,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 24 }}>📄</Text>
                <Text style={{ fontSize: 18, fontWeight: "600", color: "#111827" }}>
                  Residency / Ownership Contract
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: `${getStatusColor(contractStatus)}15`,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: getStatusColor(contractStatus),
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: getStatusColor(contractStatus) }}>
                  {getStatusIcon(contractStatus)} {getStatusText(contractStatus)}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 14, color: "#6B7280", marginBottom: 16 }}>
              Upload your residency or ownership contract
            </Text>
            {(status?.contract?.file_url || pendingContract) && (
              <View style={{ marginBottom: 12 }}>
                {isImageUrl(normalizeFileUrl(status?.contract?.file_url || pendingContract)) ? (
                  <Image
                    source={{ uri: normalizeFileUrl(status?.contract?.file_url || pendingContract) }}
                    style={{ width: "100%", height: 200, borderRadius: 12, backgroundColor: "#F3F4F6" }}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 6 }}>Document on file</Text>
                )}
                <TouchableOpacity onPress={() => openFileUrl(status?.contract?.file_url || pendingContract, apiClient)}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#2563EB", marginTop: 8 }}>
                    View uploaded file
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: "#3B82F6",
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
                onPress={() => pickDocument("CONTRACT")}
                disabled={uploading === "CONTRACT" || contractStatus === "APPROVED"}
              >
                {uploading === "CONTRACT" ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
                    {contractStatus === "APPROVED" ? "✓ Approved" : "Upload Contract"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          {canSubmit && (
            <TouchableOpacity
              style={{
                backgroundColor: "#10B981",
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: "center",
                marginBottom: 24,
                shadowColor: "#10B981",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
              }}
              onPress={submitDocuments}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                  Submit Documents for Review
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Status Summary */}
          {status && (nationalIdStatus || contractStatus) && (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 }}>
                Verification Status
              </Text>
              <View style={{ gap: 8 }}>
                {nationalIdStatus && (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, color: "#6B7280" }}>National ID:</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: getStatusColor(nationalIdStatus) }}>
                      {getStatusText(nationalIdStatus)}
                    </Text>
                  </View>
                )}
                {contractStatus && (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, color: "#6B7280" }}>Contract:</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: getStatusColor(contractStatus) }}>
                      {getStatusText(contractStatus)}
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>Overall Status:</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: getStatusColor(status.user_status) }}>
                    {status.user_status}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
