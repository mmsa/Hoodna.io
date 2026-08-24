import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Compound, ServiceCategory } from "@hoodna/shared";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import { colors } from "@/constants/colors";
import { pickAndUploadOnboardingDocument } from "@/lib/onboarding-upload";
import { SignOutButton } from "@/components/sign-out-button";

type ProviderType = "INDIVIDUAL" | "REGISTERED_BUSINESS";
type VerificationMethod = "COMMERCIAL_REGISTER" | "NATIONAL_ID_OCCUPATION";
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

export default function ProviderOnboardingScreen() {
  const router = useRouter();
  const { apiClient, user } = useAuth();
  const { t } = useTranslation();
  const steps = [
    t("providerOnboarding.businessStep"),
    t("providerOnboarding.serviceAreasStep"),
    t("providerOnboarding.verificationStep"),
    t("providerOnboarding.documentsStep"),
    t("providerOnboarding.reviewStep"),
  ];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [profileExists, setProfileExists] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
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
    setLoading(true);
    try {
      const [categoryData, compoundData] = await Promise.all([
        apiClient.getServiceCategories(),
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
      Alert.alert(t("providerOnboarding.unableToLoad"), error.message || t("providerOnboarding.connectionRetry"));
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
      Alert.alert(t("providerOnboarding.missingInformation"), t("providerOnboarding.missingBusinessInfo"));
      return;
    }
    if (step === 1 && selectedCompounds.length === 0) {
      Alert.alert(t("providerOnboarding.missingServiceArea"), t("providerOnboarding.selectOneCompound"));
      return;
    }
    if (step === 2) {
      if (!providerType || !verificationMethod) {
        Alert.alert(t("providerOnboarding.missingVerification"), t("providerOnboarding.selectVerification"));
        return;
      }
      if (verificationMethod === "NATIONAL_ID_OCCUPATION" && !occupationText.trim()) {
        Alert.alert(t("providerOnboarding.missingOccupation"), t("providerOnboarding.enterOccupation"));
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
        Alert.alert(t("providerOnboarding.unableToSave"), error.message || t("providerOnboarding.tryAgain"));
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
        Alert.alert(t("providerOnboarding.documentsRequired"), t("providerOnboarding.uploadRequiredDocuments"));
        return;
      }
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function upload(type: string) {
    setUploading(type);
    try {
      const fileUrl = await pickAndUploadOnboardingDocument(apiClient, "providers", type, {
        imageOnly: true,
        imageSourceCopy: {
          title: t("providerOnboarding.addDocumentPhoto"),
          prompt: t("providerOnboarding.choosePhotoSource"),
          takePhoto: t("providerOnboarding.takePhoto"),
          chooseLibrary: t("providerOnboarding.chooseFromLibrary"),
          cancel: t("providerOnboarding.cancelPhoto"),
          cameraPermissionTitle: t("providerOnboarding.cameraAccessNeeded"),
          cameraPermissionMessage: t("providerOnboarding.cameraAccessMessage"),
          libraryPermissionTitle: t("providerOnboarding.libraryAccessNeeded"),
          libraryPermissionMessage: t("providerOnboarding.libraryAccessMessage"),
        },
      });
      if (fileUrl) setDocuments((current) => ({ ...current, [type]: fileUrl }));
    } catch (error: any) {
      Alert.alert(t("providerOnboarding.uploadFailed"), error.message || t("providerOnboarding.tryAgain"));
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
      Alert.alert(t("providerOnboarding.submissionFailed"), error.message || t("providerOnboarding.tryAgain"));
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
    return <Loading label={t("providerOnboarding.loadingProfile")} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1" }} edges={["top"]}>
      <Header title={t("providerOnboarding.title")} onBack={() => step ? setStep(step - 1) : router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <SignOutButton style={{ marginBottom: 8 }} />
        <Text style={{ color: colors.primary, fontWeight: "700", marginBottom: 6 }}>
          {t("providerOnboarding.stepOf", { step: step + 1, total: steps.length })}
        </Text>
        <Text style={{ fontSize: 25, fontWeight: "700", color: colors.text, marginBottom: 18 }}>
          {steps[step]}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 24 }}>
          {steps.map((_, index) => (
            <View key={index} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index <= step ? colors.primary : "#D1D5DB" }} />
          ))}
        </View>

        {step === 0 && (
          <View>
            <Field label={t("providerOnboarding.businessName")} value={businessName} onChangeText={setBusinessName} placeholder={t("providerOnboarding.businessPlaceholder")} />
            <Field label={t("providerOnboarding.phoneNumber")} value={phone} onChangeText={setPhone} placeholder={t("providerOnboarding.phonePlaceholder")} keyboardType="phone-pad" />
            <Text style={labelStyle}>{t("providerOnboarding.serviceCategory")}</Text>
            {categories.length ? (
              categories.map((category) => (
                <Option key={category.id} title={`${category.icon || ""} ${category.name}`.trim()} selected={categoryId === category.id} onPress={() => setCategoryId(category.id)} />
              ))
            ) : (
              <View style={{ borderRadius: 12, backgroundColor: "#FEF3C7", padding: 14, marginBottom: 12 }}>
                <Text style={{ color: "#92400E", lineHeight: 20, marginBottom: 10 }}>
                  {t("providerOnboarding.categoriesUnavailable")}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => void load()}
                  style={{ alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#FFFFFF" }}
                >
                  <Text style={{ color: colors.primary, fontWeight: "700" }}>{t("providerOnboarding.retryCategories")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={{ color: colors.textSecondary, marginBottom: 14 }}>
              {t("providerOnboarding.serviceAreasHelp")}
            </Text>
            <CompoundPicker
              compounds={compounds}
              selectedIds={selectedCompounds}
              onToggle={toggleCompound}
            />
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={labelStyle}>{t("providerOnboarding.providerType")}</Text>
            <Option title={t("providerOnboarding.individual")} selected={providerType === "INDIVIDUAL"} onPress={() => setProviderType("INDIVIDUAL")} />
            <Option title={t("providerOnboarding.registeredBusiness")} selected={providerType === "REGISTERED_BUSINESS"} onPress={() => setProviderType("REGISTERED_BUSINESS")} />
            <Text style={[labelStyle, { marginTop: 12 }]}>{t("providerOnboarding.verificationMethod")}</Text>
            <Option title={t("providerOnboarding.commercialRegister")} selected={verificationMethod === "COMMERCIAL_REGISTER"} onPress={() => setVerificationMethod("COMMERCIAL_REGISTER")} />
            <Option title={t("providerOnboarding.nationalIdOccupation")} selected={verificationMethod === "NATIONAL_ID_OCCUPATION"} onPress={() => setVerificationMethod("NATIONAL_ID_OCCUPATION")} />
            {verificationMethod === "NATIONAL_ID_OCCUPATION" && (
              <Field label={t("providerOnboarding.occupation")} value={occupationText} onChangeText={setOccupationText} placeholder={t("providerOnboarding.occupationPlaceholder")} />
            )}
          </View>
        )}

        {step === 3 && (
          <View>
            {verificationMethod === "COMMERCIAL_REGISTER" ? (
              <>
                <DocumentButton title={t("providerOnboarding.commercialRegister")} done={!!documents.COMMERCIAL_REGISTER} loading={uploading === "COMMERCIAL_REGISTER"} onPress={() => upload("COMMERCIAL_REGISTER")} />
                <DocumentButton title={t("providerOnboarding.taxCardOptional")} done={!!documents.TAX_CARD} loading={uploading === "TAX_CARD"} onPress={() => upload("TAX_CARD")} />
              </>
            ) : (
              <>
                <DocumentButton title={t("providerOnboarding.nationalIdFront")} done={!!documents.NATIONAL_ID_FRONT} loading={uploading === "NATIONAL_ID_FRONT"} onPress={() => upload("NATIONAL_ID_FRONT")} />
                <DocumentButton title={t("providerOnboarding.nationalIdBack")} done={!!documents.NATIONAL_ID_BACK} loading={uploading === "NATIONAL_ID_BACK"} onPress={() => upload("NATIONAL_ID_BACK")} />
              </>
            )}
          </View>
        )}

        {step === 4 && (
          <View style={cardStyle}>
            <ReviewRow label={t("providerOnboarding.reviewBusiness")} value={businessName} />
            <ReviewRow label={t("providerOnboarding.reviewCategory")} value={selectedCategory?.name || t("providerOnboarding.notSelected")} />
            <ReviewRow label={t("providerOnboarding.reviewPhone")} value={phone} />
            <ReviewRow label={t("providerOnboarding.reviewServiceAreas")} value={selectedCompoundNames.join(", ")} />
            <ReviewRow label={t("providerOnboarding.reviewProviderType")} value={providerType === "INDIVIDUAL" ? t("providerOnboarding.individual") : t("providerOnboarding.registeredBusiness")} />
            <ReviewRow label={t("providerOnboarding.reviewVerification")} value={verificationMethod === "COMMERCIAL_REGISTER" ? t("providerOnboarding.commercialRegister") : t("providerOnboarding.nationalIdOccupation")} />
          </View>
        )}

        <TouchableOpacity style={primaryButtonStyle} onPress={step === 4 ? submit : next} disabled={saving || !!uploading}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{step === 4 ? t("providerOnboarding.submitForReview") : t("providerOnboarding.continue")}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Loading({ label }: { label: string }) {
  return <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9F8F1" }}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ marginTop: 12, color: colors.textSecondary }}>{label}</Text></SafeAreaView>;
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

function CompoundPicker({
  compounds,
  selectedIds,
  onToggle,
}: {
  compounds: Compound[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedCompounds = compounds.filter((compound) => selectedIds.includes(compound.id));
  const filteredCompounds = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return compounds;
    return compounds.filter(
      (compound) =>
        compound.name.toLowerCase().includes(normalizedQuery) ||
        compound.area?.toLowerCase().includes(normalizedQuery),
    );
  }, [compounds, query]);

  function openPicker() {
    setQuery("");
    setOpen(true);
  }

  return (
    <View>
      <Text style={labelStyle}>{t("providerOnboarding.serviceAreas")}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("providerOnboarding.selectServiceAreas")}
        onPress={openPicker}
        style={[cardStyle, { flexDirection: "row", alignItems: "center", paddingVertical: 14 }]}
      >
        <Ionicons name="search" size={20} color="#9CA3AF" />
        <Text style={{ flex: 1, marginHorizontal: 10, fontSize: 16, color: selectedIds.length ? colors.text : "#9CA3AF" }}>
          {selectedIds.length
            ? t("providerOnboarding.selectedCompounds", { count: selectedIds.length })
            : t("providerOnboarding.searchCompounds")}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#6B7280" />
      </TouchableOpacity>

      {selectedCompounds.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {selectedCompounds.map((compound) => (
            <TouchableOpacity
              key={compound.id}
              accessibilityRole="button"
              accessibilityLabel={t("providerOnboarding.removeCompound", { name: compound.name })}
              onPress={() => onToggle(compound.id)}
              style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 18, backgroundColor: "#D9F3EE", paddingVertical: 8, paddingHorizontal: 11 }}
            >
              <Text style={{ color: colors.primary, fontWeight: "600" }}>{compound.name}</Text>
              <Ionicons name="close-circle" size={17} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1" }} edges={["top", "bottom"]}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
            <Text style={{ flex: 1, fontSize: 19, fontWeight: "700", color: colors.text }}>{t("providerOnboarding.selectServiceAreas")}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, marginBottom: 12 }}>
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder={t("providerOnboarding.searchCompoundArea")}
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, paddingVertical: 14, marginLeft: 9, fontSize: 16, color: colors.text }}
              />
              {query.length > 0 && (
                <TouchableOpacity accessibilityRole="button" onPress={() => setQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>
              {t("providerOnboarding.selectedResults", { selected: selectedIds.length, results: filteredCompounds.length })}
            </Text>

            <FlatList
              data={filteredCompounds}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={{ textAlign: "center", color: colors.textSecondary, paddingVertical: 40 }}>{t("providerOnboarding.noCompoundResults")}</Text>}
              renderItem={({ item }) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <TouchableOpacity
                    onPress={() => onToggle(item.id)}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{item.name}</Text>
                      {item.area ? <Text style={{ marginTop: 3, color: colors.textSecondary }}>{item.area}</Text> : null}
                    </View>
                    <Ionicons name={selected ? "checkbox" : "square-outline"} size={24} color={selected ? colors.primary : "#9CA3AF"} />
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
            <TouchableOpacity style={[primaryButtonStyle, { marginTop: 0 }]} onPress={() => setOpen(false)}>
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
                {selectedIds.length
                  ? t("providerOnboarding.doneCount", { count: selectedIds.length })
                  : t("common.done")}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function DocumentButton({ title, done, loading, onPress }: { title: string; done: boolean; loading: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return <TouchableOpacity onPress={onPress} disabled={loading} style={[cardStyle, { flexDirection: "row", alignItems: "center", marginBottom: 12 }]}>{loading ? <ActivityIndicator color={colors.primary} /> : <Ionicons name={done ? "checkmark-circle" : "cloud-upload-outline"} size={26} color={done ? "#10B981" : colors.primary} />}<View style={{ marginLeft: 12, flex: 1 }}><Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{title}</Text><Text style={{ color: done ? "#059669" : colors.textSecondary, marginTop: 3 }}>{done ? t("providerOnboarding.uploadedReplace") : t("providerOnboarding.chooseFile")}</Text></View></TouchableOpacity>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <View style={{ marginBottom: 14 }}><Text style={{ color: colors.textSecondary, fontSize: 13 }}>{label}</Text><Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginTop: 3 }}>{value}</Text></View>;
}

const labelStyle = { fontSize: 14, fontWeight: "600" as const, color: colors.text, marginBottom: 8 };
const cardStyle = { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" };
const primaryButtonStyle = { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center" as const, marginTop: 24 };
