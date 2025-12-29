import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Compound } from "@hoodna/shared";

interface HeaderProps {
  title?: string;
  showLogo?: boolean;
  showBackButton?: boolean;
  rightAction?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    icon?: keyof typeof Ionicons.glyphMap;
  };
}

export function Header({ title, showLogo = true, showBackButton = false, rightAction }: HeaderProps) {
  const router = useRouter();
  const { user, apiClient, refreshUser } = useAuth();
  const [compound, setCompound] = useState<Compound | null>(null);
  const [showCompoundSwitcher, setShowCompoundSwitcher] = useState(false);
  const [availableCompounds, setAvailableCompounds] = useState<Array<{ id: number; name: string; area: string | null; is_current: boolean }>>([]);
  const [loadingCompounds, setLoadingCompounds] = useState(false);
  
  // Only try to load compound if user is authenticated and has compound_id
  const shouldLoadCompound = user && user.compound_id && apiClient;

  useEffect(() => {
    if (shouldLoadCompound) {
      loadCompound();
    } else {
      // Clear compound if user logs out or doesn't have compound_id
      setCompound(null);
    }
  }, [user?.compound_id, !!apiClient]);

  async function loadCompound() {
    if (!shouldLoadCompound) return;
    try {
      const compounds = await apiClient.getCompounds({ limit: 200 });
      // Ensure compounds is an array
      if (Array.isArray(compounds) && compounds.length > 0) {
        const foundCompound = compounds.find((c) => c.id === user?.compound_id);
        if (foundCompound) {
          setCompound(foundCompound);
        }
      }
    } catch (error) {
      // Silently fail - compound display is optional
      // Don't log errors for unauthenticated users
      if (user && apiClient) {
        console.error("Failed to load compound:", error);
      }
    }
  }

  async function loadAvailableCompounds() {
    if (!apiClient) return;
    setLoadingCompounds(true);
    try {
      const compounds = await apiClient.getUserCompounds();
      setAvailableCompounds(compounds);
    } catch (error) {
      console.error("Failed to load available compounds:", error);
    } finally {
      setLoadingCompounds(false);
    }
  }

  async function handleSwitchCompound(compoundId: number) {
    if (!apiClient) return;
    try {
      await apiClient.switchCompound(compoundId);
      await refreshUser();
      setShowCompoundSwitcher(false);
      // Reload compound to show new one
      loadCompound();
    } catch (error) {
      console.error("Failed to switch compound:", error);
    }
  }

  function openCompoundSwitcher() {
    loadAvailableCompounds();
    setShowCompoundSwitcher(true);
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Back Button */}
        {showBackButton && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.textMain} />
          </TouchableOpacity>
        )}

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
            {!title && <Text style={styles.logoText}>Hoodna.io</Text>}
          </TouchableOpacity>
        )}

        {/* Title Section */}
        {title && (
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {compound && (
              <View style={styles.compoundBadge}>
                <Ionicons name="home" size={12} color={colors.primary} />
                <Text style={styles.compoundText}>{compound.name}</Text>
              </View>
            )}
          </View>
        )}

        {/* Compound Badge (when no title) - Clickable to switch */}
        {!title && compound && (
          <TouchableOpacity 
            style={styles.compoundBadge}
            onPress={openCompoundSwitcher}
            activeOpacity={0.7}
          >
            <Ionicons name="home" size={12} color={colors.primary} />
            <Text style={styles.compoundText}>{compound.name}</Text>
            <Ionicons name="chevron-down" size={12} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Compound Badge in title section - also clickable */}
        {title && compound && (
          <TouchableOpacity 
            style={styles.compoundBadge}
            onPress={openCompoundSwitcher}
            activeOpacity={0.7}
          >
            <Ionicons name="home" size={12} color={colors.primary} />
            <Text style={styles.compoundText}>{compound.name}</Text>
            <Ionicons name="chevron-down" size={12} color={colors.primary} />
          </TouchableOpacity>
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

      {/* Compound Switcher Modal */}
      <Modal
        visible={showCompoundSwitcher}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCompoundSwitcher(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Switch Compound</Text>
              <TouchableOpacity
                onPress={() => setShowCompoundSwitcher(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.textMain} />
              </TouchableOpacity>
            </View>

            {loadingCompounds ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={availableCompounds}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.compoundItem,
                      item.is_current && styles.compoundItemCurrent,
                    ]}
                    onPress={() => handleSwitchCompound(item.id)}
                    disabled={item.is_current}
                  >
                    <View style={styles.compoundItemContent}>
                      <Ionicons
                        name="home"
                        size={20}
                        color={item.is_current ? colors.primary : colors.textMain}
                      />
                      <View style={styles.compoundItemText}>
                        <Text
                          style={[
                            styles.compoundItemName,
                            item.is_current && styles.compoundItemNameCurrent,
                          ]}
                        >
                          {item.name}
                        </Text>
                        {item.area && (
                          <Text style={styles.compoundItemArea}>{item.area}</Text>
                        )}
                      </View>
                    </View>
                    {item.is_current && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No compounds available</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
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
  backButton: {
    marginRight: 16,
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
  titleContainer: {
    flex: 1,
    flexDirection: "column",
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
  },
  compoundBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  compoundText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.primary,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  compoundItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  compoundItemCurrent: {
    backgroundColor: colors.backgroundCard,
  },
  compoundItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  compoundItemText: {
    flex: 1,
  },
  compoundItemName: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textMain,
  },
  compoundItemNameCurrent: {
    color: colors.primary,
    fontWeight: "600",
  },
  compoundItemArea: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
  },
});
