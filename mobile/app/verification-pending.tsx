import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { VerificationStatusResponse } from "@hoodna/shared";
import { getResidentRoute, isResidentRole } from "@/lib/resident-routing";
import { isImageUrl, isPdfUrl, normalizeFileUrl, openFileUrl } from "@/lib/file-url";

function DocBlock({
  title,
  status,
  fileUrl,
  docLabel,
  docColor,
}: {
  title: string;
  status?: string;
  fileUrl?: string;
  docLabel: (s: string | undefined) => string;
  docColor: (s: string | undefined) => string;
}) {
  const url = normalizeFileUrl(fileUrl);
  return (
    <View>
      <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 4 }}>{title}</Text>
      <Text style={{ fontSize: 15, fontWeight: "600", color: docColor(status), marginBottom: 8 }}>
        {status ? docLabel(status) : "Not uploaded"}
      </Text>
      {url && isImageUrl(url) ? (
        <Image
          source={{ uri: url }}
          style={{ width: "100%", height: 160, borderRadius: 10, backgroundColor: "#F3F4F6" }}
          resizeMode="contain"
        />
      ) : null}
      {url && isPdfUrl(url) ? (
        <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 6 }}>PDF document on file</Text>
      ) : null}
      {url ? (
        <TouchableOpacity onPress={() => openFileUrl(url)}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#2563EB", marginTop: 6 }}>
            View uploaded file
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

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
    if (user.status === "APPROVED") {
      router.replace("/(tabs)/home");
      return;
    }
    // No docs yet → must upload first
    if (user.verification_status === "UNVERIFIED" || user.verification_status == null) {
      // Still allow REJECTED through to this page
      if (user.status !== "REJECTED" && user.status !== "BANNED") {
        router.replace("/verification");
        return;
      }
    }
    load();
  }, [user, authLoading, router, load]);

  // Poll while waiting
  useEffect(() => {
    if (!user || user.status === "APPROVED") return;
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

  const isRejected = user?.status === "REJECTED" || user?.status === "BANNED";
  const nationalId = status?.national_id;
  const contract = status?.contract;

  function docLabel(docStatus: string | undefined) {
    if (!docStatus) return "Not submitted";
    if (docStatus === "APPROVED") return "Approved";
    if (docStatus === "REJECTED") return "Rejected";
    if (docStatus === "REQUEST_MORE_DETAILS") return "More details needed";
    return "Under review";
  }

  function docColor(docStatus: string | undefined) {
    if (!docStatus) return "#9CA3AF";
    if (docStatus === "APPROVED") return "#10B981";
    if (docStatus === "REJECTED") return "#EF4444";
    if (docStatus === "REQUEST_MORE_DETAILS") return "#D97706";
    return "#F59E0B";
  }

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

          <DocBlock
            title="National ID"
            status={nationalId?.status}
            fileUrl={nationalId?.file_url}
            docLabel={docLabel}
            docColor={docColor}
          />
          <View style={{ height: 14 }} />
          <DocBlock
            title="Contract"
            status={contract?.status}
            fileUrl={contract?.file_url}
            docLabel={docLabel}
            docColor={docColor}
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

        {(isRejected ||
          nationalId?.status === "REJECTED" ||
          contract?.status === "REJECTED" ||
          nationalId?.status === "REQUEST_MORE_DETAILS" ||
          contract?.status === "REQUEST_MORE_DETAILS") && (
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
              Re-upload documents
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
