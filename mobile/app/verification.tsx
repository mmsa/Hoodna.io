import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { DocumentType, VerificationStatusResponse } from "@hoodna/shared";
import { Ionicons } from "@expo/vector-icons";
import {
  isVerifiedForCurrentCompound,
  verificationDocumentsNeedReupload,
} from "@/lib/resident-routing";
import { UploadedDocumentCard } from "@/components/uploaded-document-card";
import { VerificationCompoundBar } from "@/components/verification-compound-bar";
import * as SecureStore from "expo-secure-store";
import { uploadLocalFileToPresignedUrl } from "@/lib/upload";
import { pickImageSource } from "@/lib/pick-media";

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
    if (user.status === "APPROVED" && isVerifiedForCurrentCompound(user)) {
      router.replace("/(tabs)/home");
      return;
    }
    if (user.verification_status === "PENDING") {
      router.replace("/verification-pending");
      return;
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
      const pendingReview =
        data.national_id?.status === "PENDING" || data.contract?.status === "PENDING";
      const needsReupload = verificationDocumentsNeedReupload(data);
      if (pendingReview && !needsReupload && data.user_status !== "REJECTED") {
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
      const image = await pickImageSource({
        allowsEditing: true,
        quality: 0.8,
        title: "Verification photo",
      });
      if (!image) return;
      await uploadDocument(type, image.uri, image.mimeType, image.fileName);
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

      const token = await SecureStore.getItemAsync("accessToken");

      await uploadLocalFileToPresignedUrl(
        presignResponse.presigned_url,
        {
          uri: fileUri,
          mimeType,
          fileName,
        },
        token ?? undefined
      );

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
        router.replace("/verification-pending");
        Alert.alert(
          "Submitted",
          "Document submitted for review. You'll get access once approved."
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
      router.replace("/verification-pending");

      Alert.alert(
        "Submitted",
        "Documents submitted for review. You'll get access once approved."
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit documents");
    } finally {
      setSubmitting(false);
    }
  }

  const nationalIdStatus = status?.national_id?.status;
  const contractStatus = status?.contract?.status;
  const hasPendingUploads = pendingNationalId || pendingContract;
  const canSubmit = hasPendingUploads && !submitting;

  function renderDocumentSection(
    type: "NATIONAL_ID" | "CONTRACT",
    title: string,
    emoji: string,
    hint: string,
    docStatus: string | undefined,
    fileUrl: string | null | undefined,
    pendingUrl: string | null,
    onUpload: () => void,
  ) {
    const hasFile = !!(fileUrl || pendingUrl);
    const displayStatus = docStatus || (pendingUrl ? "PENDING" : undefined);
    const canUpload = displayStatus !== "APPROVED" && displayStatus !== "PENDING";

    return (
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: "#E5E7EB",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827" }}>{title}</Text>
            <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 2 }}>{hint}</Text>
          </View>
        </View>

        {hasFile ? (
          <UploadedDocumentCard
            title={title}
            status={displayStatus}
            fileUrl={fileUrl || pendingUrl}
            apiClient={apiClient}
            compact
          />
        ) : (
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: "#CBD5E1",
              backgroundColor: "#F8FAFC",
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 14, color: "#64748B", textAlign: "center" }}>
              No document uploaded for this neighbourhood yet
            </Text>
          </View>
        )}

        {canUpload && (
          <TouchableOpacity
            style={{
              backgroundColor: "#158074",
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              marginTop: 12,
            }}
            onPress={onUpload}
            disabled={uploading === type}
          >
            {uploading === type ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>
                {displayStatus === "REJECTED" ? "Upload replacement" : `Upload ${title}`}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#158074" />
        <Text style={{ marginTop: 16, color: "#6C757D" }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1" }} edges={["top"]}>
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
        <View style={{ paddingHorizontal: 20, paddingVertical: 24 }}>
          <VerificationCompoundBar
            currentCompoundName={status?.compound_name}
            onCompoundChange={loadStatus}
          />

          <Text style={{ fontSize: 15, color: "#6B7280", marginBottom: 20, lineHeight: 22 }}>
            Upload <Text style={{ fontWeight: "600", color: "#111827" }}>one document</Text> — National ID or contract showing your name and this neighbourhood.
          </Text>

          {renderDocumentSection(
            "NATIONAL_ID",
            "National ID",
            "🆔",
            "Clear photo of your national ID",
            nationalIdStatus,
            status?.national_id?.file_url,
            pendingNationalId,
            () => pickImage("NATIONAL_ID"),
          )}

          {renderDocumentSection(
            "CONTRACT",
            "Residency / Ownership Contract",
            "📄",
            "Contract showing your name and address",
            contractStatus,
            status?.contract?.file_url,
            pendingContract,
            () => pickDocument("CONTRACT"),
          )}

          {canSubmit && (
            <TouchableOpacity
              style={{
                backgroundColor: "#10B981",
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: "center",
                marginBottom: 24,
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
