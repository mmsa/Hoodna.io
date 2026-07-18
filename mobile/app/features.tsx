import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/constants/colors";

interface FeatureItem {
  title: string;
  description: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  requiresAuth?: boolean;
}

function FeatureCard({ feature, onPress, disabled = false }: { feature: FeatureItem; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.backgroundCard,
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: disabled ? 0.6 : 1,
      }}
      activeOpacity={0.82}
      disabled={disabled}
      onPress={onPress}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: `${feature.color}18`,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Ionicons name={feature.icon} size={24} color={feature.color} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMain, marginBottom: 6 }}>
        {feature.title}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textMuted }}>
        {feature.description}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: feature.color }}>
          Open feature
        </Text>
        <Ionicons name="arrow-forward" size={14} color={feature.color} style={{ marginLeft: 6 }} />
      </View>
    </TouchableOpacity>
  );
}

export default function FeaturesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const isAdmin = user?.role === "ADMIN";

  const mainFeatures: FeatureItem[] = [
    {
      title: "Community Feed",
      description: "Share updates, ask neighbors for help, and follow what is happening around your community.",
      route: "/(tabs)/home",
      icon: "home",
      color: colors.primary,
    },
    {
      title: "Marketplace",
      description: "Browse items for sale or rent inside your compound and create listings when you need to sell.",
      route: "/(tabs)/market",
      icon: "storefront",
      color: colors.success,
      requiresAuth: true,
    },
    {
      title: "Services",
      description: "Discover resident-facing services, or manage your own service listings if you are a provider.",
      route: "/(tabs)/services",
      icon: "construct",
      color: colors.accent,
      requiresAuth: true,
    },
    {
      title: "Messages",
      description: "Keep conversations with sellers, service providers, and neighbors in one place.",
      route: "/(tabs)/messages",
      icon: "chatbubbles",
      color: colors.purple,
      requiresAuth: true,
    },
    {
      title: "Notifications",
      description: "Track new replies, listing activity, and verification updates as they happen.",
      route: "/notifications",
      icon: "notifications",
      color: colors.pink,
      requiresAuth: true,
    },
    {
      title: "Saved Listings",
      description: "Revisit the listings you bookmarked without searching the marketplace again.",
      route: "/saved-listings",
      icon: "bookmark",
      color: "#D97706",
      requiresAuth: true,
    },
    {
      title: "Verification",
      description: "Upload your documents and track review progress to unlock posting, comments, and more.",
      route: "/verification",
      icon: "shield-checkmark",
      color: "#7C3AED",
      requiresAuth: true,
    },
    {
      title: "Profile",
      description: "Review your account details, active compound, provider status, and app shortcuts.",
      route: "/(tabs)/profile",
      icon: "person-circle",
      color: "#EA580C",
      requiresAuth: true,
    },
    {
      title: "Settings",
      description: "Update your name and phone number to keep your account information current.",
      route: "/settings",
      icon: "settings",
      color: "#158074",
      requiresAuth: true,
    },
  ];

  const quickActions: FeatureItem[] = [
    {
      title: "Create Post",
      description: "Start a new community update.",
      route: "/create-post",
      icon: "add-circle",
      color: colors.primary,
      requiresAuth: true,
    },
    {
      title: "Create Listing",
      description: "Choose an item, car or property to publish in the marketplace.",
      route: "/create-listing",
      icon: "pricetag",
      color: colors.success,
      requiresAuth: true,
    },
    {
      title: "Search",
      description: "Look across posts, listings, and services.",
      route: "/search",
      icon: "search",
      color: colors.purple,
      requiresAuth: true,
    },
  ];

  if (isAdmin) {
    mainFeatures.push({
      title: "Admin Dashboard",
      description: "Review resident verifications, provider applications, and moderator approvals.",
      route: "/admin/dashboard",
      icon: "shield",
      color: "#DC2626",
      requiresAuth: true,
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Header showLogo={true} showBackButton={true} title="All Features" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16, paddingBottom: 40 }}>
          <View
            style={{
              backgroundColor: colors.backgroundCard,
              borderRadius: 22,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 28, fontWeight: "800", color: colors.textMain, marginBottom: 8 }}>
              Everything in Eljiran
            </Text>
            <Text style={{ fontSize: 15, lineHeight: 22, color: colors.textMuted }}>
              This screen mirrors the web app’s feature directory so mobile users can discover the full product surface.
            </Text>
          </View>

          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textMain, marginBottom: 14 }}>
            Main Features
          </Text>
          <View style={{ gap: 14, marginBottom: 24 }}>
            {mainFeatures.map((feature) => {
              const disabled = !!feature.requiresAuth && !isAuthenticated;
              return (
                <FeatureCard
                  key={feature.title}
                  feature={feature}
                  disabled={disabled}
                  onPress={() => router.push(feature.route)}
                />
              );
            })}
          </View>

          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textMain, marginBottom: 14 }}>
            Quick Actions
          </Text>
          <View style={{ gap: 12 }}>
            {quickActions.map((action) => {
              const disabled =
                (!!action.requiresAuth && !isAuthenticated) ||
                (action.title === "Create Listing" &&
                  (!user?.can_create_listing || user.role === "SERVICE_PROVIDER"));
              return (
                <FeatureCard
                  key={action.title}
                  feature={action}
                  disabled={disabled}
                  onPress={() => router.push(action.route)}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
