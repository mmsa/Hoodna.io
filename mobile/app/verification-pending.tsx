import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { VerificationStatusResponse } from "@hoodna/shared";
import {
  getResidentRoute,
  isResidentRole,
  isVerifiedForCurrentCompound,
  isVerificationRejected,
  verificationDocumentsNeedReupload,
} from "@/lib/resident-routing";
import { UploadedDocumentCard } from "@/components/uploaded-document-card";

export default function VerificationPendingScreen() {
  const { user, loading: authLoading, apiClient, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<VerificationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiClient.getVerificationStatus();
      setStatus(data);
      await refreshUser();
    } catch (error) {
      console.error("Failed to load verification status:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiClient, refreshUser]);

  const hasDocs = !!(status?.national_id || status?.contract);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (!isResidentRole(user.role)) {
      router.replace("/");
      return;
    }
    if (!user.compound_id) {
      router.replace("/onboarding/compound-select");
      return;
    }
    load();
  }, [user, authLoading, router, load]);

  useEffect(() => {
    if (authLoading || loading || !user) return;
    if (
      !hasDocs &&
      user.verification_status !== "PENDING" &&
      user.status !== "REJECTED" &&
      user.status !== "BANNED"
    ) {
      router.replace("/verification");
    }
  }, [user, authLoading, loading, hasDocs, router]);

  useEffect(() => {
    if (!user || (user.status === "APPROVED" && isVerifiedForCurrentCompound(user))) return;
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [user, load]);

  useEffect(() => {
    if (!user) return;
    const route = getResidentRoute(user);
    if (route === "/(tabs)/home") {
      router.replace(route);
    }
  }, [user, router]);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 16, color: "#6B7280" }}>Checking verification status...</Text>
      </SafeAreaView>
    );
  }

  const isRejected = isVerificationRejected(user!, status);
  const canReupload =
    isRejected || verificationDocumentsNeedReupload(status) || !hasDocs;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF" }}>
      <ScrollView
        contentContainerStyle={{ padding: 24, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={{ alignItems: "center", marginBottom: 32, marginTop: 24 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: isRejected ? "#FEE2E2" : "#FEF3C7",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <Ionicons
              name={isRejected ? "close-circle" : "hourglass"}
              size={44}
              color={isRejected ? "#EF4444" : "#D97706"}
            />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "700", color: "#111827", textAlign: "center", marginBottom: 8 }}>
            {isRejected ? "Verification rejected" : "Verification under review"}
          </Text>
          <Text style={{ fontSize: 15, color: "#6B7280", textAlign: "center", lineHeight: 22 }}>
            {isRejected
              ? "Your documents were not approved. You can re-upload and submit again."
              : "We've received your documents. Our team is reviewing them — you'll get full access once approved. You can't use the community until then."}
          </Text>
        </View>

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
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
            Your uploaded documents
          </Text>
          <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
            These stay after you refresh or reopen the app
          </Text>

          <UploadedDocumentCard
            title="National ID"
            status={status?.national_id?.status}
            fileUrl={status?.national_id?.file_url}
            apiClient={apiClient}
          />
          <View style={{ height: 12 }} />
          <UploadedDocumentCard
            title="Contract"
            status={status?.contract?.status}
            fileUrl={status?.contract?.file_url}
            apiClient={apiClient}
          />
        </View>

        <View
          style={{
            backgroundColor: isRejected ? "#FEE2E2" : "#DBEAFE",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <Text style={{ fontSize: 14, color: isRejected ? "#991B1B" : "#1E40AF", textAlign: "center" }}>
            {isRejected
              ? "Pull to refresh after re-submitting, or tap below to upload again."
              : "This usually takes a short time. Pull down to refresh status."}
          </Text>
        </View>

        {canReupload && (
          <TouchableOpacity
            style={{
              backgroundColor: "#3B82F6",
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
              marginBottom: 12,
            }}
            onPress={() => router.replace("/verification")}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
              {hasDocs ? "Re-upload documents" : "Upload documents"}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={{
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#D1D5DB",
            backgroundColor: "#FFFFFF",
          }}
          onPress={async () => {
            await logout();
            router.replace("/auth");
          }}
        >
          <Text style={{ color: "#6B7280", fontSize: 16, fontWeight: "600" }}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
