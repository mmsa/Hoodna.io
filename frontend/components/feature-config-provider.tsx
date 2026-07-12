"use client"

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react"
import {
  FeatureConfigSchema,
  type FeatureConfig,
  type FeatureFlagKey,
} from "@hoodna/shared"
import { useQuery } from "@tanstack/react-query"

import api from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"
import { reportError, track } from "@/lib/telemetry"

const SAFE_DEFAULTS: FeatureConfig["flags"] = {
  invitations: false,
  business_claiming: false,
  weekly_digest: false,
  community_posting: false,
  business_reviews: false,
  user_registration: true,
}

type FeatureConfigContextValue = {
  config: FeatureConfig
  isLoading: boolean
  isEnabled: (key: FeatureFlagKey) => boolean
}

const FeatureConfigContext = createContext<FeatureConfigContextValue | null>(null)

export function FeatureConfigProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const query = useQuery({
    queryKey: ["feature-config", isAuthenticated],
    queryFn: async () => {
      const endpoint = isAuthenticated ? "/api/config/me" : "/api/config/public"
      const response = await api.get(endpoint)
      return FeatureConfigSchema.parse(response.data)
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  const config = query.data || { flags: SAFE_DEFAULTS }

  useEffect(() => {
    track("app_opened", { source_screen: "web_app" })
    const onError = (event: ErrorEvent) => reportError(event.error || new Error(event.message), { error_kind: "render" })
    const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason, { error_kind: "unhandled_promise" })
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return (
    <FeatureConfigContext.Provider
      value={{
        config,
        isLoading: query.isLoading,
        isEnabled: (key) => config.flags[key] ?? SAFE_DEFAULTS[key],
      }}
    >
      {children}
    </FeatureConfigContext.Provider>
  )
}

export function useFeatureConfig() {
  const value = useContext(FeatureConfigContext)
  if (!value) throw new Error("useFeatureConfig must be used within FeatureConfigProvider")
  return value
}

export function FeatureGate({
  flag,
  children,
  fallback = null,
}: {
  flag: FeatureFlagKey
  children: ReactNode
  fallback?: ReactNode
}) {
  const { isEnabled, isLoading } = useFeatureConfig()
  if (isLoading) return null
  return isEnabled(flag) ? children : fallback
}
