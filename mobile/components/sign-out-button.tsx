import { useRef, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { spacing, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const HELPER_COPY =
  "Entered the wrong details? Sign out to start again or use another account.";

interface SignOutButtonProps {
  style?: StyleProp<ViewStyle>;
}

export function SignOutButton({ style }: SignOutButtonProps) {
  const router = useRouter();
  const { logout } = useAuth();
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
      <Text style={styles.helper}>{HELPER_COPY}</Text>
      <Text style={styles.sessionNote}>
        Signing out only clears this session. It does not delete your account.
      </Text>
      <Button
        accessibilityHint="Clears this session and returns to authentication"
        accessibilityLabel="Sign out and start again"
        leading={<Ionicons name="log-out-outline" size={20} color={colors.text} />}
        loading={signingOut}
        loadingLabel="Signing out..."
        onPress={handleSignOut}
        variant="outline"
      >
        Sign out and start again
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
