import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Compound } from "@hoodna/shared";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/constants/colors";
import { pickAndUploadOnboardingDocument } from "@/lib/onboarding-upload";

type ModeratorProfile = {
  moderator_status?: string;
  compound_id?: number;
  role_title?: string;
  documents?: Array<{ document_type: string; file_url: string }>;
};

const STEPS = ["Compound", "Role information", "Documents", "Review"];
const REQUIRED_DOCUMENTS = ["NATIONAL_ID_FRONT", "NATIONAL_ID_BACK", "AUTHORIZATION_LETTER"];

export default function ModeratorOnboardingScreen() {
  const router = useRouter();
  const { apiClient, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [profileExists, setProfileExists] = useState(false);
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [compoundId, setCompoundId] = useState<number | null>(null);
  const [roleTitle, setRoleTitle] = useState("");
  const [documents, setDocuments] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "COMPOUND_MOD") {
      router.replace("/onboarding/choose-role");
      return;
    }
    void load();
  }, [user]);

  async function load() {
    try {
      setCompounds(await apiClient.getCompounds({ limit: 200 }));
      try {
        const profile = await apiClient.getModeratorProfile() as ModeratorProfile;
        setProfileExists(true);
        setCompoundId(profile.compound_id || null);
        setRoleTitle(profile.role_title || "");
        setDocuments(
          Object.fromEntries((profile.documents || []).map((doc) => [doc.document_type, doc.file_url])),
        );
        if (profile.moderator_status && !["DRAFT", "REJECTED"].includes(profile.moderator_status)) {
          router.replace("/moderator/status");
        }
      } catch {
        setProfileExists(false);
      }
    } catch (error: any) {
      Alert.alert("Unable to load", error.message || "Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function next() {
    if (step === 0) {
      if (!compoundId) {
        Alert.alert("Select a compound", "Choose the compound you are authorized to moderate.");
        return;
      }
      setSaving(true);
      try {
        if (profileExists) {
          await apiClient.request("/api/moderators/me", {
            method: "PATCH",
            body: JSON.stringify({ compound_id: compoundId }),
          });
        } else {
          await apiClient.request("/api/moderators/onboarding/start", {
            method: "POST",
            body: JSON.stringify({ compound_id: compoundId, role_title: roleTitle.trim() || "Moderator" }),
          });
          setProfileExists(true);
        }
      } catch (error: any) {
        Alert.alert("Unable to save", error.message || "Please try again.");
        return;
      } finally {
        setSaving(false);
      }
    }
    if (step === 1) {
      if (!roleTitle.trim()) {
        Alert.alert("Enter your role", "Use the official title shown on your authorization letter.");
        return;
      }
      setSaving(true);
      try {
        await apiClient.request("/api/moderators/me", {
          method: "PATCH",
          body: JSON.stringify({ role_title: roleTitle.trim() }),
        });
      } catch (error: any) {
        Alert.alert("Unable to save", error.message || "Please try again.");
        return;
      } finally {
        setSaving(false);
      }
    }
    if (step === 2 && REQUIRED_DOCUMENTS.some((type) => !documents[type])) {
      Alert.alert("Documents required", "Upload both sides of your ID and your authorization letter.");
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  async function upload(type: string) {
    setUploading(type);
    try {
      const fileUrl = await pickAndUploadOnboardingDocument(apiClient, "moderators", type);
      if (fileUrl) setDocuments((current) => ({ ...current, [type]: fileUrl }));
    } catch (error: any) {
      Alert.alert("Upload failed", error.message || "Please try again.");
    } finally {
      setUploading(null);
    }
  }

  async function submit() {
    setSaving(true);
    try {
      await apiClient.request("/api/moderators/onboarding/submit", { method: "POST" });
      router.replace("/moderator/status");
    } catch (error: any) {
      Alert.alert("Submission failed", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const selectedCompound = useMemo(
    () => compounds.find((compound) => compound.id === compoundId),
    [compounds, compoundId],
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F3FF" }}>
        <ActivityIndicator size="large" color="#9333EA" />
        <Text style={{ marginTop: 12, color: colors.textSecondary }}>Loading moderator profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F3FF" }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
        <TouchableOpacity onPress={() => step ? setStep(step - 1) : router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ marginLeft: 14, fontSize: 18, fontWeight: "700", color: colors.text, flex: 1 }}>
          Compound Moderator Onboarding
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ color: "#9333EA", fontWeight: "700", marginBottom: 6 }}>
          Step {step + 1} of {STEPS.length}
        </Text>
        <Text style={{ fontSize: 25, fontWeight: "700", color: colors.text, marginBottom: 18 }}>{STEPS[step]}</Text>
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 24 }}>
          {STEPS.map((_, index) => (
            <View key={index} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index <= step ? "#9333EA" : "#D1D5DB" }} />
          ))}
        </View>

        {step === 0 && (
          <View>
            <Text style={{ color: colors.textSecondary, marginBottom: 14 }}>
              Choose the compound named in your authorization letter.
            </Text>
            {compounds.map((compound) => (
              <Option key={compound.id} title={compound.name} subtitle={compound.area || undefined} selected={compoundId === compound.id} onPress={() => setCompoundId(compound.id)} />
            ))}
          </View>
        )}

        {step === 1 && (
          <Field
            label="Official role title"
            value={roleTitle}
            onChangeText={setRoleTitle}
            placeholder="Community Admin, HOA Manager..."
          />
        )}

        {step === 2 && (
          <View>
            <Text style={{ color: colors.textSecondary, lineHeight: 21, marginBottom: 16 }}>
              The authorization letter must include the compound name, your full name, role, issue date, and signature or stamp.
            </Text>
            <DocumentButton title="National ID Front" done={!!documents.NATIONAL_ID_FRONT} loading={uploading === "NATIONAL_ID_FRONT"} onPress={() => upload("NATIONAL_ID_FRONT")} />
            <DocumentButton title="National ID Back" done={!!documents.NATIONAL_ID_BACK} loading={uploading === "NATIONAL_ID_BACK"} onPress={() => upload("NATIONAL_ID_BACK")} />
            <DocumentButton title="Authorization Letter" done={!!documents.AUTHORIZATION_LETTER} loading={uploading === "AUTHORIZATION_LETTER"} onPress={() => upload("AUTHORIZATION_LETTER")} />
          </View>
        )}

        {step === 3 && (
          <View style={cardStyle}>
            <ReviewRow label="Compound" value={selectedCompound?.name || "Not selected"} />
            <ReviewRow label="Role title" value={roleTitle} />
            <ReviewRow label="Documents" value={`${REQUIRED_DOCUMENTS.filter((type) => documents[type]).length} of ${REQUIRED_DOCUMENTS.length} uploaded`} />
          </View>
        )}

        <TouchableOpacity style={primaryButtonStyle} onPress={step === 3 ? submit : next} disabled={saving || !!uploading}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{step === 3 ? "Submit for Review" : "Continue"}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return <View style={{ marginBottom: 16 }}><Text style={labelStyle}>{label}</Text><TextInput {...inputProps} placeholderTextColor="#9CA3AF" style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 12, padding: 14, fontSize: 16, color: colors.text }} /></View>;
}

function Option({ title, subtitle, selected, onPress }: { title: string; subtitle?: string; selected: boolean; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[cardStyle, { flexDirection: "row", alignItems: "center", borderColor: selected ? "#9333EA" : "#E5E7EB", borderWidth: selected ? 2 : 1, marginBottom: 10 }]}><View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{title}</Text>{subtitle ? <Text style={{ color: colors.textSecondary, marginTop: 3 }}>{subtitle}</Text> : null}</View><Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={24} color={selected ? "#9333EA" : "#9CA3AF"} /></TouchableOpacity>;
}

function DocumentButton({ title, done, loading, onPress }: { title: string; done: boolean; loading: boolean; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} disabled={loading} style={[cardStyle, { flexDirection: "row", alignItems: "center", marginBottom: 12 }]}>{loading ? <ActivityIndicator color="#9333EA" /> : <Ionicons name={done ? "checkmark-circle" : "cloud-upload-outline"} size={26} color={done ? "#10B981" : "#9333EA"} />}<View style={{ marginLeft: 12, flex: 1 }}><Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{title}</Text><Text style={{ color: done ? "#059669" : colors.textSecondary, marginTop: 3 }}>{done ? "Uploaded — tap to replace" : "Choose image or PDF"}</Text></View></TouchableOpacity>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <View style={{ marginBottom: 14 }}><Text style={{ color: colors.textSecondary, fontSize: 13 }}>{label}</Text><Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginTop: 3 }}>{value}</Text></View>;
}

const labelStyle = { fontSize: 14, fontWeight: "600" as const, color: colors.text, marginBottom: 8 };
const cardStyle = { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" };
const primaryButtonStyle = { backgroundColor: "#9333EA", borderRadius: 14, paddingVertical: 16, alignItems: "center" as const, marginTop: 24 };
