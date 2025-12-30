import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, ActivityIndicator, Alert, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useCompound } from "@/contexts/CompoundContext";
import { Compound } from "@hoodna/shared";
import { formatCompoundName, formatCompoundWithArea } from "@/utils/formatCompound";

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

// Cache compound data to avoid reloading on every page
let compoundCache: { id: number; name: string; area?: string } | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function Header({ title, showLogo = true, showBackButton = false, rightAction }: HeaderProps) {
  const router = useRouter();
  const { user, apiClient, refreshUser } = useAuth();
  const { activeCompoundId, isSwitching, switchCompound } = useCompound();
  const [compound, setCompound] = useState<Compound | null>(null);
  const [showCompoundSwitcher, setShowCompoundSwitcher] = useState(false);
  const [availableCompounds, setAvailableCompounds] = useState<Array<{ id: number; name: string; area: string | null; is_current: boolean }>>([]);
  const [loadingCompounds, setLoadingCompounds] = useState(false);
  
  // Use activeCompoundId from context (single source of truth)
  const compoundIdToLoad = activeCompoundId || user?.compound_id;
  const shouldLoadCompound = user && compoundIdToLoad && apiClient;

  useEffect(() => {
    if (shouldLoadCompound) {
      // Check cache first
      const now = Date.now();
      if (compoundCache && compoundCache.id === compoundIdToLoad && (now - cacheTimestamp) < CACHE_DURATION) {
        setCompound(compoundCache as Compound);
      } else {
        // Load in background, don't block UI
        loadCompound();
      }
    } else {
      // Clear compound if user logs out or doesn't have compound_id
      setCompound(null);
      compoundCache = null;
    }
  }, [compoundIdToLoad]); // Watch activeCompoundId from context

  async function loadCompound() {
    if (!shouldLoadCompound || !apiClient || !compoundIdToLoad) return;
    
    // Load in background - don't block UI rendering
    // Use getUserCompounds which is optimized and includes current compound
    try {
      const userCompounds = await apiClient.getUserCompounds();
      const foundCompound = userCompounds.find((c) => c.id === compoundIdToLoad);
      if (foundCompound) {
        // Convert to Compound format
        const compoundData = {
          id: foundCompound.id,
          name: foundCompound.name,
          area: foundCompound.area || undefined,
        } as Compound;
        setCompound(compoundData);
        // Cache it
        compoundCache = compoundData;
        cacheTimestamp = Date.now();
      } else {
        setCompound(null);
        compoundCache = null;
      }
    } catch (error) {
      // Silently fail - compound display is optional
      // Don't clear cache on error, might be temporary network issue
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
    if (isSwitching) return; // Prevent multiple switches
    
    try {
      setShowCompoundSwitcher(false);
      // Use compound context's switchCompound which handles persistence and invalidation
      await switchCompound(compoundId);
      // Reload compound to show new one
      loadCompound();
    } catch (error: any) {
      // Error handling is done in CompoundContext
      // Just log here for debugging
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
          <View style={styles.logoSection}>
            <TouchableOpacity
              style={styles.logoContainer}
              onPress={() => router.push("/(tabs)/home")}
              activeOpacity={0.7}
            >
              <Image
                source={require('@/assets/logo_light.jpg')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
            {/* Always show compound badge next to logo when no title */}
            {!title && compound && (
              <TouchableOpacity 
                style={styles.compoundBadgeInline}
                onPress={openCompoundSwitcher}
                activeOpacity={0.7}
              >
                <Ionicons name="home" size={10} color={colors.primary} />
                <Text style={styles.compoundTextInline}>{formatCompoundName(compound.name)}</Text>
                <Ionicons name="chevron-down" size={10} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Title Section */}
        {title && (
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {compound && (
              <TouchableOpacity 
                style={styles.compoundBadge}
                onPress={openCompoundSwitcher}
                activeOpacity={0.7}
              >
                <Ionicons name="home" size={12} color={colors.primary} />
                <Text style={styles.compoundText}>{formatCompoundName(compound.name)}</Text>
                <Ionicons name="chevron-down" size={12} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
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

        {/* Search Button */}
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => router.push("/search")}
          activeOpacity={0.7}
        >
          <Ionicons name="search" size={22} color={colors.textMain} />
        </TouchableOpacity>

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
              <Text style={styles.modalTitle}>Switch Neighbourhood</Text>
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
              <>
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
                            {formatCompoundWithArea(item.name, item.area)}
                          </Text>
                        </View>
                      </View>
                      {item.is_current && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No verified neighbourhoods available</Text>
                      <Text style={styles.emptySubtext}>Submit verification documents to access neighbourhoods</Text>
                    </View>
                  }
                />
                <TouchableOpacity
                  style={styles.requestAccessButton}
                  onPress={() => {
                    setShowCompoundSwitcher(false);
                    router.push("/onboarding/compound-select");
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.requestAccessText}>Request Access to New Neighbourhood</Text>
                </TouchableOpacity>
              </>
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
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compoundBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  compoundTextInline: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.primary,
  },
  logoImage: {
    width: 150,
    height: 50,
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
  searchButton: {
    padding: 8,
    marginRight: 8,
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
    fontWeight: "500",
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  requestAccessButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 8,
  },
  requestAccessText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
});
