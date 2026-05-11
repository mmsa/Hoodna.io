import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Image, ActivityIndicator, TextInput, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Listing } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { formatCompoundName } from "@/utils/formatCompound";

const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest First" },
  { value: "date_asc", label: "Oldest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

function ServiceCard({ service, router }: { service: Listing; router: any }) {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.backgroundCard,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: 16,
      }}
      activeOpacity={0.8}
      onPress={() => router.push(`/listing/${service.id}`)}
    >
      {service.image_urls && service.image_urls.length > 0 ? (
        <Image
          source={{ uri: service.image_urls[0] }}
          style={{ width: "100%", height: 180 }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: "100%",
            height: 180,
            backgroundColor: "#FEF3C7",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="construct" size={64} color={colors.accent} />
        </View>
      )}

      <View style={{ padding: 16 }}>
        {/* Service Provider Badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <View
            style={{
              backgroundColor: `${colors.accent}15`,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.accent }}>
              Service Provider
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: colors.textMain,
            marginBottom: 6,
          }}
          numberOfLines={2}
        >
          {service.title}
        </Text>

        {service.description && (
          <Text
            style={{
              fontSize: 14,
              color: colors.textMuted,
              marginBottom: 12,
              lineHeight: 20,
            }}
            numberOfLines={2}
          >
            {service.description}
          </Text>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            {service.price && (
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: colors.accent,
                }}
              >
                {service.price.toLocaleString()} EGP
              </Text>
            )}
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              {service.intent === "RENT" ? "per hour" : "one-time"}
            </Text>
          </View>

          {/* Rating Placeholder - Will be implemented with reviews */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: "#FEF3C7",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 12,
            }}
          >
            <Ionicons name="star" size={16} color="#F59E0B" />
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#92400E" }}>
              New
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

interface ProviderProfile {
  id: number;
  provider_status: string;
}

export default function ServicesScreen() {
  const [services, setServices] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [compoundName, setCompoundName] = useState<string | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const { user, apiClient } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadServices();
    // Only load compound name for residents, not service providers
    if (user?.role !== "SERVICE_PROVIDER") {
      loadCompoundName();
    }
    // Load provider profile for service providers
    if (user?.role === "SERVICE_PROVIDER") {
      loadProviderProfile();
    }
  }, [user?.compound_id, user?.role, searchQuery, sortBy]);

  async function loadCompoundName() {
    if (!user?.compound_id || !apiClient) return;
    
    try {
      const userCompounds = await apiClient.getUserCompounds();
      const foundCompound = userCompounds.find((c) => c.id === user.compound_id);
      if (foundCompound) {
        setCompoundName(foundCompound.name);
      }
    } catch (error) {
      console.error("Failed to load compound name:", error);
    }
  }

  async function loadProviderProfile() {
    if (!user || user.role !== "SERVICE_PROVIDER" || !apiClient) return;
    
    try {
      const profile = await apiClient.getProviderProfile();
      setProviderProfile(profile);
    } catch (error: any) {
      console.error("Failed to load provider profile:", error);
      // If profile doesn't exist (404), that's okay - user needs to complete onboarding
      if (error?.status !== 404) {
        setProviderProfile(null);
      }
    }
  }

  async function loadServices() {
    // For service providers, use scope=my to show only their own services
    // For residents, use scope=compound to show all services in their compound
    const isServiceProvider = user?.role === "SERVICE_PROVIDER";
    
    if (!isServiceProvider && !user?.compound_id) {
      setLoading(false);
      return;
    }
    
    if (!apiClient) {
      setLoading(false);
      return;
    }

    try {
      const params: any = {
        scope: isServiceProvider ? "my" : "compound",
        category: "SERVICE", // Only services
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      params.sort_by = sortBy;

      const data = await apiClient.getListings(params);
      setServices(data || []);
    } catch (error: any) {
      console.error("Failed to load services:", error);
      // Redirect to verification if user is not verified for compound (only for residents)
      if (!isServiceProvider && (error?.message?.includes("403") || error?.response?.status === 403)) {
        router.push("/verification");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadServices();
  }

  // Only allow approved service providers to create services
  const canCreateService = user?.role === "SERVICE_PROVIDER" && providerProfile?.provider_status === "APPROVED";

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Header title="Services" showLogo={false} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user?.compound_id) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Header title="Services" showLogo={false} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.textMain, marginBottom: 12, textAlign: "center" }}>
            Select Your Compound
          </Text>
          <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: "center", lineHeight: 24, marginBottom: 32 }}>
            To see services from your community, please select a compound first.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
            onPress={() => router.push("/onboarding/compound-select")}
          >
            <Ionicons name="home" size={20} color="#FFFFFF" />
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
              Select Compound
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Header
        title={user?.role === "SERVICE_PROVIDER" ? "My Services" : "Services"}
        showLogo={false}
        rightAction={
          canCreateService
            ? {
                label: "+ Service",
                onPress: () => router.push("/create-listing?category=SERVICE"),
                disabled: !canCreateService,
              }
            : undefined
        }
      />

      <FlatList
        data={services}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
            {/* Info Banner - Only show for residents, not service providers */}
            {user?.role !== "SERVICE_PROVIDER" && (
              <View
                style={{
                  backgroundColor: "#FEF3C7",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: "#FDE68A",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="information-circle" size={20} color="#92400E" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#92400E", marginBottom: 2 }}>
                      Verified Service Providers
                    </Text>
                    <Text style={{ fontSize: 12, color: "#78350F" }}>
                      All services are from verified neighbors in {compoundName ? formatCompoundName(compoundName) : "your compound"}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Search */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: colors.gray50,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.textMain,
                }}
                placeholder="Search services..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.trim() && (
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.gray300,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 12,
                    justifyContent: "center",
                  }}
                  onPress={() => setSearchQuery("")}
                >
                  <Text style={{ fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Sort Options */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {SORT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={{
                      backgroundColor: sortBy === option.value ? colors.accent : colors.backgroundCard,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 2,
                      borderColor: sortBy === option.value ? colors.accent : colors.border,
                    }}
                    onPress={() => setSortBy(option.value)}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: sortBy === option.value ? "#FFFFFF" : colors.textMain,
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => <ServiceCard service={item} router={router} />}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Ionicons name="construct-outline" size={64} color={colors.textMuted} />
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.textMain, marginTop: 16, marginBottom: 8 }}>
              No services yet
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center" }}>
              {searchQuery.trim()
                ? "No services match your search"
                : `Be the first to offer a service in ${compoundName ? formatCompoundName(compoundName) : "your compound"}!`}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}
