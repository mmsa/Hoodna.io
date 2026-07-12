import Constants from "expo-constants";
import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { Platform } from "react-native";
import {
  FirstPartyApiAnalytics,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
  type ClientErrorReport,
} from "@hoodna/shared";
import { useAuth } from "@/contexts/AuthContext";

type ErrorKind = ClientErrorReport["error_kind"];

interface TelemetryContextValue {
  track: <K extends AnalyticsEventName>(
    event: K,
    properties?: AnalyticsEventProperties[K],
  ) => void;
  captureError: (error: unknown, kind?: ErrorKind, route?: string) => void;
}

const TelemetryContext = createContext<TelemetryContextValue | undefined>(undefined);

function platform(): "ios" | "android" {
  return Platform.OS === "android" ? "android" : "ios";
}

function fingerprint(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const value = `${error.name}:${error.stack?.split("\n").slice(0, 3).join("|") || ""}`;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const { apiClient } = useAuth();
  const analytics = useMemo(() => new FirstPartyApiAnalytics(apiClient, 1), [apiClient]);

  const captureError = useCallback(
    (error: unknown, kind: ErrorKind = "unknown", route?: string) => {
      const report: ClientErrorReport = {
        error_code: error instanceof Error ? error.name.slice(0, 100) || "Error" : "UnknownError",
        error_kind: kind,
        occurred_at: new Date().toISOString(),
        platform: platform(),
        environment: __DEV__ ? "development" : "production",
        release: Constants.expoConfig?.version,
        route,
        stack_fingerprint: fingerprint(error),
      };
      void apiClient.reportClientError(report).catch(() => undefined);
    },
    [apiClient],
  );

  const track = useCallback<TelemetryContextValue["track"]>(
    (event, properties) => {
      void analytics.track(event, {
        platform: platform(),
        app_version: Constants.expoConfig?.version,
        ...properties,
      } as never).catch((error) => captureError(error, "api"));
    },
    [analytics, captureError],
  );

  useEffect(() => {
    track("app_opened", {});
  }, [track]);

  useEffect(() => {
    const originalRequest = apiClient.request.bind(apiClient);
    apiClient.request = async <T,>(endpoint: string, options = {}) => {
      try {
        return await originalRequest<T>(endpoint, options);
      } catch (error) {
        if (!endpoint.startsWith("/api/telemetry/")) {
          captureError(error, "api", endpoint);
        }
        throw error;
      }
    };
    return () => {
      apiClient.request = originalRequest;
    };
  }, [apiClient, captureError]);

  const value = useMemo(() => ({ track, captureError }), [captureError, track]);
  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry() {
  const value = useContext(TelemetryContext);
  if (!value) throw new Error("useTelemetry must be used within TelemetryProvider");
  return value;
}
