import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { BusinessDetail } from "@hoodna/shared";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { KeyboardScreen } from "@/components/ui/screen";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useFeature } from "@/contexts/FeatureConfigContext";
import { useTelemetry } from "@/contexts/TelemetryContext";

export default function ClaimBusinessScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { apiClient, user } = useAuth();
  const enabled = useFeature("business_claiming");
  const { track } = useTelemetry();
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [fullName, setFullName] = useState(user?.name || "");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [information, setInformation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (slug) void apiClient.getBusiness(slug).then(setBusiness).catch(() => setBusiness(null));
  }, [apiClient, slug]);

  if (!enabled) return <KeyboardScreen><Header title="Claim business" showBackButton /><EmptyState title="Business claiming is unavailable" /></KeyboardScreen>;
  if (!business) return <KeyboardScreen><Header title="Claim business" showBackButton /><LoadingState label="Loading business" /></KeyboardScreen>;

  async function submit() {
    if (!fullName.trim() || role.trim().length < 2 || phone.trim().length < 5 || !email.includes("@")) {
      Alert.alert("Check your details", "Complete your name, relationship, phone, and email.");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.submitBusinessClaim(business!.id, {
        full_name: fullName.trim(),
        relationship_role: role.trim(),
        phone: phone.trim(),
        email: email.trim(),
        supporting_information: information.trim() || undefined,
        requested_role: "OWNER",
      });
      track("business_claim_submitted", { business_id: business!.id });
      Alert.alert("Claim submitted", "We will notify you after your claim is reviewed.", [
        { text: "View status", onPress: () => router.replace("/business-claims") },
      ]);
    } catch (error: any) {
      Alert.alert("Could not submit claim", error.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardScreen contentContainerStyle={styles.content}>
      <Header title="Claim business" showBackButton />
      <Text accessibilityRole="header" style={styles.title}>Claim {business.name}</Text>
      <Text style={styles.help}>Tell us how you are connected to this business. Claims are reviewed before access is granted.</Text>
      <Field label="Full name" value={fullName} onChangeText={setFullName} />
      <Field label="Your relationship to the business" value={role} onChangeText={setRole} placeholder="Owner, manager, authorised employee" />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Supporting information (optional)" value={information} onChangeText={setInformation} multiline />
      <Button loading={submitting} loadingLabel="Submitting claim" onPress={submit}>Submit claim</Button>
    </KeyboardScreen>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return <>
    <Text style={styles.label}>{label}</Text>
    <TextInput placeholderTextColor={colors.textMuted} style={[styles.input, props.multiline && styles.multiline]} {...props} />
  </>;
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 32 },
  title: { color: colors.textMain, fontSize: 23, fontWeight: "700", marginTop: 8 },
  help: { color: colors.textMuted, lineHeight: 21, marginBottom: 8 },
  label: { color: colors.textMain, fontWeight: "600", marginTop: 5 },
  input: { minHeight: 48, backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, color: colors.textMain },
  multiline: { minHeight: 100, paddingTop: 12, textAlignVertical: "top" },
});
