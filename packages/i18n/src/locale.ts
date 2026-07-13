export const SUPPORTED_LOCALES = ["en", "ar"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export const LOCALE_STORAGE_KEY = "eljiran-locale";

export function isRTL(locale: SupportedLocale): boolean {
  return locale === "ar";
}

export function normalizeLocale(value: string | null | undefined): SupportedLocale {
  if (!value) return DEFAULT_LOCALE;
  const base = value.toLowerCase().split("-")[0];
  return base === "ar" ? "ar" : "en";
}

export function detectBrowserLocale(): SupportedLocale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const languages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const language of languages) {
    if (normalizeLocale(language) === "ar") return "ar";
  }
  return DEFAULT_LOCALE;
}

export function detectDeviceLocale(): SupportedLocale {
  try {
    const IntlWithLocale = Intl as typeof Intl & {
      DateTimeFormat: typeof Intl.DateTimeFormat & {
        resolvedOptions: () => Intl.ResolvedDateTimeFormatOptions;
      };
    };
    return normalizeLocale(IntlWithLocale.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return DEFAULT_LOCALE;
  }
}
