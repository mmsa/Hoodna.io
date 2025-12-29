import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

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
            <LinearGradient
              colors={["#3B82F6", "#9333EA"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoBox}
            >
              <Ionicons name="home" size={20} color="#FFFFFF" />
            </LinearGradient>
            <LinearGradient
              colors={["#2563EB", "#9333EA"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.logoTextContainer}
            >
              <Text style={styles.logoText}>Hoodna.io</Text>
            </LinearGradient>
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
    alignItems: "center",
    justifyContent: "center",
  },
  logoTextContainer: {
    paddingHorizontal: 0,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2563EB",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    flex: 1,
  },
  rightButton: {
    backgroundColor: "#3B82F6",
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
