import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { FeatureConfig, FeatureFlagKey } from "@hoodna/shared";
import { useAuth } from "@/contexts/AuthContext";

const FALLBACK_FLAGS: FeatureConfig["flags"] = {
  invitations: false,
  business_claiming: false,
  weekly_digest: false,
  community_posting: false,
  business_reviews: false,
  user_registration: true,
};

interface FeatureConfigContextValue {
  config: FeatureConfig;
  loading: boolean;
  refresh: () => Promise<void>;
  isEnabled: (key: FeatureFlagKey) => boolean;
}

const FeatureConfigContext = createContext<FeatureConfigContextValue | undefined>(undefined);

export function FeatureConfigProvider({ children }: { children: React.ReactNode }) {
  const { apiClient, user, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<FeatureConfig>({ flags: FALLBACK_FLAGS });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = user
        ? await apiClient.getMyFeatureConfig()
        : await apiClient.getPublicFeatureConfig();
      setConfig(next);
    } catch {
      // Keep the last-known fail-closed config during a temporary outage.
    } finally {
      setLoading(false);
    }
  }, [apiClient, user]);

  useEffect(() => {
    if (!authLoading) void refresh();
  }, [authLoading, refresh]);

  const value = useMemo<FeatureConfigContextValue>(
    () => ({
      config,
      loading,
      refresh,
      isEnabled: (key) => config.flags[key] ?? false,
    }),
    [config, loading, refresh],
  );

  return <FeatureConfigContext.Provider value={value}>{children}</FeatureConfigContext.Provider>;
}

export function useFeatureConfig() {
  const value = useContext(FeatureConfigContext);
  if (!value) throw new Error("useFeatureConfig must be used within FeatureConfigProvider");
  return value;
}

export function useFeature(key: FeatureFlagKey): boolean {
  return useFeatureConfig().isEnabled(key);
}
