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

type ProviderType = "INDIVIDUAL" | "REGISTERED_BUSINESS";
type VerificationMethod = "COMMERCIAL_REGISTER" | "NATIONAL_ID_OCCUPATION";
type Category = { id: number; name: string; description?: string; icon?: string };
type ProviderProfile = {
  provider_status?: string;
  provider_type?: ProviderType;
  verification_method?: VerificationMethod;
  business_name?: string;
  category_id?: number;
  phone?: string;
  service_area_compound_ids?: number[];
  occupation_text?: string;
  documents?: Array<{ document_type: string; file_url: string }>;
};

const STEPS = ["Business", "Service areas", "Verification", "Documents", "Review"];

export default function ProviderOnboardingScreen() {
  const router = useRouter();
  const { apiClient, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [profileExists, setProfileExists] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [selectedCompounds, setSelectedCompounds] = useState<number[]>([]);
  const [providerType, setProviderType] = useState<ProviderType | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod | null>(null);
  const [occupationText, setOccupationText] = useState("");
  const [documents, setDocuments] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "SERVICE_PROVIDER") {
      router.replace("/onboarding/choose-role");
      return;
    }
    void load();
  }, [user]);

  async function load() {
    try {
      const [categoryData, compoundData] = await Promise.all([
        apiClient.request<Category[]>("/api/service-categories"),
        apiClient.getCompounds({ limit: 200 }),
      ]);
      setCategories(categoryData || []);
      setCompounds(compoundData || []);
      try {
        const profile = await apiClient.getProviderProfile() as ProviderProfile;
        setProfileExists(true);
        setBusinessName(profile.business_name || "");
        setPhone(profile.phone || "");
        setCategoryId(profile.category_id || null);
        setSelectedCompounds(profile.service_area_compound_ids || []);
        setProviderType(profile.provider_type || null);
        setVerificationMethod(profile.verification_method || null);
        setOccupationText(profile.occupation_text || "");
        setDocuments(
          Object.fromEntries((profile.documents || []).map((doc) => [doc.document_type, doc.file_url])),
        );
        if (profile.provider_status && !["DRAFT", "REJECTED"].includes(profile.provider_status)) {
          router.replace("/provider/status");
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

  function toggleCompound(id: number) {
    setSelectedCompounds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function next() {
    if (step === 0 && (!businessName.trim() || !phone.trim() || !categoryId)) {
      Alert.alert("Missing information", "Enter a business name, phone number, and service category.");
      return;
    }
    if (step === 1 && selectedCompounds.length === 0) {
      Alert.alert("Missing service area", "Select at least one compound.");
      return;
    }
    if (step === 2) {
      if (!providerType || !verificationMethod) {
        Alert.alert("Missing verification details", "Select a provider type and verification method.");
        return;
      }
      if (verificationMethod === "NATIONAL_ID_OCCUPATION" && !occupationText.trim()) {
        Alert.alert("Missing occupation", "Enter the occupation shown on your ID.");
        return;
      }
      setSaving(true);
      try {
        const data = {
          provider_type: providerType,
          verification_method: verificationMethod,
          business_name: businessName.trim(),
          category_id: categoryId,
          phone: phone.trim(),
          service_area_compound_ids: selectedCompounds,
          occupation_text: occupationText.trim() || null,
        };
        if (profileExists) {
          await apiClient.updateProviderProfile(data);
        } else {
          await apiClient.request("/api/providers/onboarding/start", {
            method: "POST",
            body: JSON.stringify(data),
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
    if (step === 3) {
      const required =
        verificationMethod === "COMMERCIAL_REGISTER"
          ? ["COMMERCIAL_REGISTER"]
          : ["NATIONAL_ID_FRONT", "NATIONAL_ID_BACK"];
      if (required.some((type) => !documents[type])) {
        Alert.alert("Documents required", "Upload all required verification documents.");
        return;
      }
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  async function upload(type: string) {
    setUploading(type);
    try {
      const fileUrl = await pickAndUploadOnboardingDocument(apiClient, "providers", type);
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
      await apiClient.request("/api/providers/onboarding/submit", { method: "POST" });
      router.replace("/provider/status");
    } catch (error: any) {
      Alert.alert("Submission failed", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const selectedCompoundNames = useMemo(
    () => compounds.filter((compound) => selectedCompounds.includes(compound.id)).map((compound) => compound.name),
    [compounds, selectedCompounds],
  );

  if (loading) {
    return <Loading label="Loading provider profile..." />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF" }} edges={["top"]}>
      <Header title="Service Provider Onboarding" onBack={() => step ? setStep(step - 1) : router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ color: colors.primary, fontWeight: "700", marginBottom: 6 }}>
          Step {step + 1} of {STEPS.length}
        </Text>
        <Text style={{ fontSize: 25, fontWeight: "700", color: colors.text, marginBottom: 18 }}>
          {STEPS[step]}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 24 }}>
          {STEPS.map((_, index) => (
            <View key={index} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index <= step ? colors.primary : "#D1D5DB" }} />
          ))}
        </View>

        {step === 0 && (
          <View>
            <Field label="Business name" value={businessName} onChangeText={setBusinessName} placeholder="Your business name" />
            <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="+20..." keyboardType="phone-pad" />
            <Text style={labelStyle}>Service category</Text>
            {categories.map((category) => (
              <Option key={category.id} title={`${category.icon || ""} ${category.name}`.trim()} selected={categoryId === category.id} onPress={() => setCategoryId(category.id)} />
            ))}
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={{ color: colors.textSecondary, marginBottom: 14 }}>Select every compound where you provide services.</Text>
            {compounds.map((compound) => (
              <Option key={compound.id} title={compound.name} subtitle={compound.area || undefined} selected={selectedCompounds.includes(compound.id)} onPress={() => toggleCompound(compound.id)} />
            ))}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={labelStyle}>Provider type</Text>
            <Option title="Individual" selected={providerType === "INDIVIDUAL"} onPress={() => setProviderType("INDIVIDUAL")} />
            <Option title="Registered business" selected={providerType === "REGISTERED_BUSINESS"} onPress={() => setProviderType("REGISTERED_BUSINESS")} />
            <Text style={[labelStyle, { marginTop: 12 }]}>Verification method</Text>
            <Option title="Commercial Register" selected={verificationMethod === "COMMERCIAL_REGISTER"} onPress={() => setVerificationMethod("COMMERCIAL_REGISTER")} />
            <Option title="National ID with occupation" selected={verificationMethod === "NATIONAL_ID_OCCUPATION"} onPress={() => setVerificationMethod("NATIONAL_ID_OCCUPATION")} />
            {verificationMethod === "NATIONAL_ID_OCCUPATION" && (
              <Field label="Occupation" value={occupationText} onChangeText={setOccupationText} placeholder="Plumber, electrician..." />
            )}
          </View>
        )}

        {step === 3 && (
          <View>
            {verificationMethod === "COMMERCIAL_REGISTER" ? (
              <>
                <DocumentButton title="Commercial Register" done={!!documents.COMMERCIAL_REGISTER} loading={uploading === "COMMERCIAL_REGISTER"} onPress={() => upload("COMMERCIAL_REGISTER")} />
                <DocumentButton title="Tax Card (optional)" done={!!documents.TAX_CARD} loading={uploading === "TAX_CARD"} onPress={() => upload("TAX_CARD")} />
              </>
            ) : (
              <>
                <DocumentButton title="National ID Front" done={!!documents.NATIONAL_ID_FRONT} loading={uploading === "NATIONAL_ID_FRONT"} onPress={() => upload("NATIONAL_ID_FRONT")} />
                <DocumentButton title="National ID Back" done={!!documents.NATIONAL_ID_BACK} loading={uploading === "NATIONAL_ID_BACK"} onPress={() => upload("NATIONAL_ID_BACK")} />
              </>
            )}
          </View>
        )}

        {step === 4 && (
          <View style={cardStyle}>
            <ReviewRow label="Business" value={businessName} />
            <ReviewRow label="Category" value={selectedCategory?.name || "Not selected"} />
            <ReviewRow label="Phone" value={phone} />
            <ReviewRow label="Service areas" value={selectedCompoundNames.join(", ")} />
            <ReviewRow label="Provider type" value={providerType || ""} />
            <ReviewRow label="Verification" value={verificationMethod || ""} />
          </View>
        )}

        <TouchableOpacity style={primaryButtonStyle} onPress={step === 4 ? submit : next} disabled={saving || !!uploading}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{step === 4 ? "Submit for Review" : "Continue"}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Loading({ label }: { label: string }) {
  return <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#EFF6FF" }}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ marginTop: 12, color: colors.textSecondary }}>{label}</Text></SafeAreaView>;
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return <View style={{ flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}><TouchableOpacity onPress={onBack} hitSlop={10}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity><Text style={{ marginLeft: 14, fontSize: 18, fontWeight: "700", color: colors.text, flex: 1 }}>{title}</Text></View>;
}

function Field(props: ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return <View style={{ marginBottom: 16 }}><Text style={labelStyle}>{label}</Text><TextInput {...inputProps} placeholderTextColor="#9CA3AF" style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 12, padding: 14, fontSize: 16, color: colors.text }} /></View>;
}

function Option({ title, subtitle, selected, onPress }: { title: string; subtitle?: string; selected: boolean; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[cardStyle, { flexDirection: "row", alignItems: "center", borderColor: selected ? colors.primary : "#E5E7EB", borderWidth: selected ? 2 : 1, marginBottom: 10 }]}><View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{title}</Text>{subtitle ? <Text style={{ color: colors.textSecondary, marginTop: 3 }}>{subtitle}</Text> : null}</View><Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={24} color={selected ? colors.primary : "#9CA3AF"} /></TouchableOpacity>;
}

function DocumentButton({ title, done, loading, onPress }: { title: string; done: boolean; loading: boolean; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} disabled={loading} style={[cardStyle, { flexDirection: "row", alignItems: "center", marginBottom: 12 }]}>{loading ? <ActivityIndicator color={colors.primary} /> : <Ionicons name={done ? "checkmark-circle" : "cloud-upload-outline"} size={26} color={done ? "#10B981" : colors.primary} />}<View style={{ marginLeft: 12, flex: 1 }}><Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{title}</Text><Text style={{ color: done ? "#059669" : colors.textSecondary, marginTop: 3 }}>{done ? "Uploaded — tap to replace" : "Choose image or PDF"}</Text></View></TouchableOpacity>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <View style={{ marginBottom: 14 }}><Text style={{ color: colors.textSecondary, fontSize: 13 }}>{label}</Text><Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginTop: 3 }}>{value}</Text></View>;
}

const labelStyle = { fontSize: 14, fontWeight: "600" as const, color: colors.text, marginBottom: 8 };
const cardStyle = { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" };
const primaryButtonStyle = { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center" as const, marginTop: 24 };
