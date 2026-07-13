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
