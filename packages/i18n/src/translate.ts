import { ar } from "./messages/ar";
import { en } from "./messages/en";
import type { MessageKey } from "./messages/en";
import type { SupportedLocale } from "./locale";

const catalogs: Record<SupportedLocale, typeof en> = {
  en,
  ar,
};

export type { MessageKey };

export function getMessages(locale: SupportedLocale) {
  return catalogs[locale] ?? catalogs.en;
}

type InterpolationValues = Record<string, string | number>;

function resolvePath(tree: Record<string, unknown>, key: string): string | undefined {
  const value = key.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object" && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, tree);
  return typeof value === "string" ? value : undefined;
}

function interpolate(template: string, values?: InterpolationValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = values[token];
    return value === undefined ? `{${token}}` : String(value);
  });
}

export function translate(
  locale: SupportedLocale,
  key: MessageKey,
  values?: InterpolationValues,
): string {
  const tree = getMessages(locale) as unknown as Record<string, unknown>;
  const message = resolvePath(tree, key);
  if (!message) {
    const fallback = resolvePath(catalogs.en as unknown as Record<string, unknown>, key);
    return interpolate(fallback ?? key, values);
  }
  return interpolate(message, values);
}

export function createTranslator(locale: SupportedLocale) {
  return (key: MessageKey, values?: InterpolationValues) => translate(locale, key, values);
}

export function formatRelativeTime(
  locale: SupportedLocale,
  dateInput: Date | string,
): string {
  const t = createTranslator(locale);
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("feed.justNow");
  if (diffMins < 60) return t("feed.minutesAgo", { count: diffMins });
  if (diffHours < 24) return t("feed.hoursAgo", { count: diffHours });
  if (diffDays < 7) return t("feed.daysAgo", { count: diffDays });
  return date.toLocaleDateString(locale === "ar" ? "ar-EG" : undefined);
}
