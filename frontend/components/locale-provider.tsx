'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  createTranslator,
  detectBrowserLocale,
  isRTL,
  normalizeLocale,
  type MessageKey,
  type SupportedLocale,
} from '@hoodna/i18n'

import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'

type LocaleContextValue = {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => Promise<void>
  t: (key: MessageKey, values?: Record<string, string | number>) => string
  isRTL: boolean
  ready: boolean
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function applyDocumentLocale(locale: SupportedLocale) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.lang = locale
  root.dir = isRTL(locale) ? 'rtl' : 'ltr'
}

function readStoredLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return value === 'en' || value === 'ar' ? value : null
}

function LocaleBootstrap() {
  const { isAuthenticated } = useAuth()
  const { ready, setLocale } = useLocale()
  const preferences = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => (await api.get('/api/auth/me/preferences')).data as { locale?: SupportedLocale },
    enabled: ready && isAuthenticated,
    retry: false,
  })

  useEffect(() => {
    if (!preferences.data?.locale) return
    void setLocale(preferences.data.locale)
  }, [preferences.data?.locale, setLocale])

  return null
}

export function AppLocaleProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = readStoredLocale()
    const resolved = stored ?? detectBrowserLocale()
    setLocaleState(normalizeLocale(resolved))
    applyDocumentLocale(normalizeLocale(resolved))
    setReady(true)
  }, [])

  useEffect(() => {
    applyDocumentLocale(locale)
  }, [locale])

  const setLocale = useCallback(
    async (nextLocale: SupportedLocale) => {
      const normalized = normalizeLocale(nextLocale)
      setLocaleState(normalized)
      window.localStorage.setItem(LOCALE_STORAGE_KEY, normalized)
      applyDocumentLocale(normalized)
      if (isAuthenticated) {
        try {
          await api.patch('/api/auth/me/preferences', { locale: normalized })
        } catch {
          // Keep local preference when offline.
        }
      }
    },
    [isAuthenticated],
  )

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: createTranslator(locale),
      isRTL: isRTL(locale),
      ready,
    }),
    [locale, ready, setLocale],
  )

  return (
    <LocaleContext.Provider value={value}>
      <LocaleBootstrap />
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within AppLocaleProvider')
  }
  return context
}

export function useTranslation() {
  const { t, locale, setLocale, isRTL, ready } = useLocale()
  return { t, locale, setLocale, isRTL, ready }
}
