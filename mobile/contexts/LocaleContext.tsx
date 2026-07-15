import * as SecureStore from "expo-secure-store";
import { I18nManager, View } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  createTranslator,
  detectDeviceLocale,
  isRTL,
  normalizeLocale,
  type MessageKey,
  type SupportedLocale,
} from "@hoodna/i18n";

import { useAuth } from "@/contexts/AuthContext";

type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  isRTL: boolean;
  ready: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function applyRtlLayout(locale: SupportedLocale) {
  const shouldUseRtl = isRTL(locale);
  if (I18nManager.isRTL !== shouldUseRtl) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(shouldUseRtl);
  }
}

function LocaleShell({
  locale,
  children,
}: {
  locale: SupportedLocale;
  children: ReactNode;
}) {
  const rtl = isRTL(locale);

  return (
    <View style={{ flex: 1, direction: rtl ? "rtl" : "ltr" }}>
      {children}
    </View>
  );
}

function LocaleBootstrap({
  isAuthenticated,
  apiClient,
}: {
  isAuthenticated: boolean;
  apiClient: { getUserPreferences: () => Promise<{ locale?: SupportedLocale }> };
}) {
  const { ready, setLocale } = useLocale();

  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    let active = true;
    void apiClient.getUserPreferences().then((preferences) => {
      if (!active || !preferences.locale) return;
      void setLocale(preferences.locale);
    });
    return () => {
      active = false;
    };
  }, [apiClient, isAuthenticated, ready, setLocale]);

  return null;
}

export function AppLocaleProvider({ children }: { children: ReactNode }) {
  const { user, apiClient } = useAuth();
  const isAuthenticated = !!user;
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(LOCALE_STORAGE_KEY).then((stored) => {
      if (!active) return;
      const resolved = stored === "en" || stored === "ar" ? stored : detectDeviceLocale();
      const normalized = normalizeLocale(resolved);
      setLocaleState(normalized);
      applyRtlLayout(normalized);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback(
    async (nextLocale: SupportedLocale) => {
      const normalized = normalizeLocale(nextLocale);
      setLocaleState(normalized);
      await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, normalized);
      applyRtlLayout(normalized);
      if (isAuthenticated) {
        try {
          await apiClient.updateUserPreferences({ locale: normalized });
        } catch {
          // Keep local preference when offline.
        }
      }
    },
    [apiClient, isAuthenticated],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: createTranslator(locale),
      isRTL: isRTL(locale),
      ready,
    }),
    [locale, ready, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <LocaleBootstrap isAuthenticated={isAuthenticated} apiClient={apiClient} />
      <LocaleShell locale={locale}>{children}</LocaleShell>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within AppLocaleProvider");
  }
  return context;
}

export function useTranslation() {
  const { t, locale, setLocale, isRTL, ready } = useLocale();
  return { t, locale, setLocale, isRTL, ready };
}
