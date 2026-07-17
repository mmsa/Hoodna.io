import { useRef, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { spacing, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/button";

interface SignOutButtonProps {
  style?: StyleProp<ViewStyle>;
}

export function SignOutButton({ style }: SignOutButtonProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const { t } = useTranslation();
  const signingOutRef = useRef(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOutRef.current) return;

    signingOutRef.current = true;
    setSigningOut(true);
    try {
      await logout();
    } finally {
      router.replace("/auth");
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.helper}>{t("common.wrongDetails")}</Text>
      <Text style={styles.sessionNote}>
        {t("common.signOutSessionNote")}
      </Text>
      <Button
        accessibilityHint={t("common.signOutHint")}
        accessibilityLabel={t("common.signOutStartAgain")}
        leading={<Ionicons name="log-out-outline" size={20} color={colors.text} />}
        loading={signingOut}
        loadingLabel={t("common.signingOut")}
        onPress={handleSignOut}
        variant="outline"
      >
        {t("common.signOutStartAgain")}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
    paddingVertical: spacing[4],
  },
  helper: {
    color: colors.text,
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.body,
    textAlign: "center",
  },
  sessionNote: {
    color: colors.textSecondary,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
    marginBottom: spacing[1],
    textAlign: "center",
  },
});
