import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";

interface HeaderProps {
  title?: string;
  showLogo?: boolean;
  rightAction?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    icon?: keyof typeof Ionicons.glyphMap;
  };
}

export function Header({ title, showLogo = true, rightAction }: HeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo Section */}
        {showLogo && (
          <TouchableOpacity
            style={styles.logoContainer}
            onPress={() => router.push("/(tabs)/home")}
            activeOpacity={0.7}
          >
            <View style={styles.logoBox}>
              <Ionicons name="home" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.logoText}>Hoodna.io</Text>
          </TouchableOpacity>
        )}

        {/* Title Section */}
        {title && !showLogo && (
          <Text style={styles.title}>{title}</Text>
        )}

        {/* Right Action */}
        {rightAction && (
          <TouchableOpacity
            style={[
              styles.rightButton,
              rightAction.disabled && styles.rightButtonDisabled,
            ]}
            onPress={rightAction.onPress}
            disabled={rightAction.disabled}
            activeOpacity={0.7}
          >
            {rightAction.icon && (
              <Ionicons
                name={rightAction.icon}
                size={16}
                color="#FFFFFF"
                style={{ marginRight: 4 }}
              />
            )}
            <Text style={styles.rightButtonText}>{rightAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary, // Blue-500
    alignItems: "center",
    justifyContent: "center",
    // Gradient effect using shadow
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primaryDark, // Blue-600
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    flex: 1,
  },
  rightButton: {
    backgroundColor: colors.primary, // Blue-500 (matching web app)
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  rightButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  rightButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
