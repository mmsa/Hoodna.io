import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, ActivityIndicator, Alert, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useCompound } from "@/contexts/CompoundContext";
import { Compound } from "@hoodna/shared";
import { formatCompoundName, formatCompoundWithArea } from "@/utils/formatCompound";
import { BrandWordmark } from "@/components/BrandWordmark";
import { palette, radii, spacing, touchTarget, typography } from "@hoodna/tokens";

type SwitchableCompound = {
  id: number;
  name: string;
  area: string | null;
  is_current: boolean;
  is_verified: boolean;
};

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

// Cache compound data per compound id
const compoundCache = new Map<number, { compound: Compound; ts: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function Header({ title, showLogo = true, showBackButton = false, rightAction }: HeaderProps) {
  const router = useRouter();
  const { user, apiClient, refreshUser } = useAuth();
  const { activeCompoundId, isSwitching, switchCompound } = useCompound();
  const [compound, setCompound] = useState<Compound | null>(null);
  const [showCompoundSwitcher, setShowCompoundSwitcher] = useState(false);
  const [availableCompounds, setAvailableCompounds] = useState<SwitchableCompound[]>([]);
  const [loadingCompounds, setLoadingCompounds] = useState(false);
  
  // Use activeCompoundId from context (single source of truth)
  const compoundIdToLoad = activeCompoundId || user?.compound_id;
  const shouldLoadCompound = user && compoundIdToLoad && apiClient;

  useEffect(() => {
    if (shouldLoadCompound && compoundIdToLoad) {
      const now = Date.now();
      const cached = compoundCache.get(compoundIdToLoad);
      if (cached && now - cached.ts < CACHE_DURATION) {
        setCompound(cached.compound);
      } else {
        loadCompound(compoundIdToLoad);
      }
    } else {
      setCompound(null);
    }
  }, [compoundIdToLoad, shouldLoadCompound]);

  async function loadCompound(compoundId: number) {
    if (!apiClient) return;

    try {
      const userCompounds = await apiClient.getUserCompounds();
      const foundCompound = userCompounds.find((c) => c.id === compoundId);
      if (foundCompound) {
        const compoundData: Compound = {
          id: foundCompound.id,
          name: foundCompound.name,
          area: foundCompound.area ?? null,
          developer: null,
          status_2025: null,
          category: null,
        };
        setCompound(compoundData);
        compoundCache.set(compoundId, { compound: compoundData, ts: Date.now() });
      } else if (compoundId === compoundIdToLoad) {
        setCompound(null);
        compoundCache.delete(compoundId);
      }
    } catch (error) {
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
      setAvailableCompounds(
        (compounds || []).map((c) => ({
          ...c,
          is_verified: c.is_verified ?? true,
        }))
      );
    } catch (error) {
      console.error("Failed to load available compounds:", error);
    } finally {
      setLoadingCompounds(false);
    }
  }

  async function handleSwitchCompound(compoundId: number, isVerified: boolean) {
    if (isSwitching) return;

    try {
      setShowCompoundSwitcher(false);
      await switchCompound(compoundId);
      await refreshUser();
      loadCompound(compoundId);
      if (isVerified) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/verification");
      }
    } catch (error: any) {
      console.error("Failed to switch compound:", error);
    }
  }

  function openCompoundSwitcher() {
    loadAvailableCompounds();
    setShowCompoundSwitcher(true);
  }

  const compactHeader = !!rightAction;
  const useTitleLayout = !!title;
  const showLogoOnly = showLogo && !useTitleLayout;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Back Button */}
        {showBackButton && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={palette.onPrimary} />
          </TouchableOpacity>
        )}

        {/* Logo Section */}
        {showLogoOnly && (
          <View style={styles.logoSection}>
            <TouchableOpacity
              style={styles.logoContainer}
              onPress={() => router.push("/(tabs)/home")}
              activeOpacity={0.7}
            >
              <Image
                source={require("@/assets/icon.png")}
                style={[styles.logoIcon, compactHeader && styles.logoIconCompact]}
                resizeMode="cover"
              />
              <BrandWordmark compact={compactHeader} />
            </TouchableOpacity>
            {/* Always show compound badge next to logo when no title */}
            {!title && compound && (
              <TouchableOpacity 
                style={styles.compoundBadgeInline}
                onPress={openCompoundSwitcher}
                activeOpacity={0.7}
              >
                <Ionicons name="home" size={10} color={palette.onPrimary} />
                <Text
                  style={styles.compoundTextInline}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {formatCompoundName(compound.name)}
                </Text>
                <Ionicons name="chevron-down" size={10} color={palette.onPrimary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Title Section */}
        {useTitleLayout && (
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {compound && (
              <TouchableOpacity 
                style={styles.compoundBadge}
                onPress={openCompoundSwitcher}
                activeOpacity={0.7}
              >
                <Ionicons name="home" size={12} color={palette.onPrimary} />
                <Text style={styles.compoundText} numberOfLines={1} ellipsizeMode="tail">
                  {formatCompoundName(compound.name)}
                </Text>
                <Ionicons name="chevron-down" size={12} color={palette.onPrimary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.actionsSection}>
          {/* Search Button */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => router.push("/search")}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Ionicons name="search" size={22} color={palette.onPrimary} />
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
              accessibilityRole="button"
              accessibilityLabel={rightAction.label}
            >
              {rightAction.icon && (
                <Ionicons
                  name={rightAction.icon}
                  size={16}
                  color="#FFFFFF"
                  style={{ marginRight: 4 }}
                />
              )}
              <Text style={styles.rightButtonText} numberOfLines={1}>
                {rightAction.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showLogoOnly ? (
        <TouchableOpacity
          accessibilityLabel="Search neighbours, posts, and services"
          activeOpacity={0.8}
          onPress={() => router.push("/search")}
          style={styles.searchBar}
        >
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.65)" />
          <Text style={styles.searchPlaceholder}>Search neighbours, posts, services…</Text>
          <Ionicons name="options-outline" size={16} color="rgba(255,255,255,0.65)" />
        </TouchableOpacity>
      ) : null}

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
                accessibilityRole="button"
                accessibilityLabel="Close neighbourhood switcher"
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
                      onPress={() => handleSwitchCompound(item.id, item.is_verified)}
                      disabled={item.is_current || isSwitching}
                    >
                      <View style={styles.compoundItemContent}>
                        <Ionicons
                          name={item.is_verified ? "checkmark-circle" : "hourglass-outline"}
                          size={20}
                          color={
                            item.is_verified
                              ? colors.success
                              : item.is_current
                                ? colors.primary
                                : colors.textMuted
                          }
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
                          <Text
                            style={{
                              fontSize: 12,
                              color: item.is_verified ? colors.success : "#D97706",
                              marginTop: 2,
                            }}
                          >
                            {item.is_verified ? "Verified" : "Verification in progress"}
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
                      <Text style={styles.emptyText}>No neighbourhoods yet</Text>
                      <Text style={styles.emptySubtext}>
                        Request access and submit verification documents
                      </Text>
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
    backgroundColor: "#07534F",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minWidth: 0,
  },
  backButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing[2],
  },
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
    direction: "ltr",
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.medium,
  },
  logoIconCompact: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  compoundBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 150,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  compoundTextInline: {
    fontSize: 11,
    fontWeight: "500",
    color: palette.onPrimary,
    flexShrink: 1,
  },
  titleContainer: {
    flex: 1,
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },
  title: {
    fontSize: typography.size.title,
    lineHeight: typography.lineHeight.title,
    fontWeight: typography.weight.semibold,
    color: palette.onPrimary,
  },
  compoundBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  compoundText: {
    fontSize: 12,
    fontWeight: "500",
    color: palette.onPrimary,
    flexShrink: 1,
  },
  actionsSection: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    marginLeft: 8,
  },
  searchButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing[1],
    flexShrink: 0,
  },
  searchBar: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginTop: spacing[2],
    borderRadius: radii.medium,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: spacing[3],
  },
  searchPlaceholder: {
    flex: 1,
    color: "rgba(255,255,255,0.68)",
    fontSize: typography.size.caption,
  },
  rightButton: {
    backgroundColor: palette.accent,
    paddingHorizontal: 16,
    minHeight: touchTarget,
    borderRadius: radii.medium,
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    maxWidth: 112,
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
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
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
