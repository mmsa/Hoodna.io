import { z } from "zod";

/** The complete Eljiran private-alpha analytics taxonomy. */
export const ANALYTICS_EVENT_NAMES = [
  "app_opened",
  "registration_started",
  "registration_completed",
  "onboarding_step_viewed",
  "onboarding_completed",
  "community_selected",
  "search_performed",
  "search_result_opened",
  "post_created",
  "comment_created",
  "business_profile_viewed",
  "business_claim_submitted",
  "invite_shared",
  "referral_registration_completed",
  "notification_opened",
  "report_submitted",
] as const;

export const AnalyticsEventNameSchema = z.enum(ANALYTICS_EVENT_NAMES);
export type AnalyticsEventName = z.infer<typeof AnalyticsEventNameSchema>;
export type AnalyticsPropertyValue = string | number | boolean | null;

type CommonProperties = {
  platform?: "web" | "ios" | "android";
  app_version?: string;
  source_screen?: string;
};

export interface AnalyticsEventProperties {
  app_opened: CommonProperties;
  registration_started: CommonProperties & { method?: "email" | "phone"; referral_present?: boolean };
  registration_completed: CommonProperties & { method?: "email" | "phone"; role?: string };
  onboarding_step_viewed: CommonProperties & { step?: string; step_number?: number };
  onboarding_completed: CommonProperties & { steps_completed?: number };
  community_selected: CommonProperties & { community_id?: number };
  search_performed: CommonProperties & { category?: string; result_count?: number };
  search_result_opened: CommonProperties & { entity_type?: string; entity_id?: number; position?: number };
  post_created: CommonProperties & { post_id?: number; category?: string; community_id?: number };
  comment_created: CommonProperties & { comment_id?: number; post_id?: number };
  business_profile_viewed: CommonProperties & { business_id?: number; category?: string };
  business_claim_submitted: CommonProperties & { business_id?: number };
  invite_shared: CommonProperties & { channel?: "native_share" | "clipboard" | "other" };
  referral_registration_completed: CommonProperties & { inviter_id?: number };
  notification_opened: CommonProperties & { notification_id?: number; notification_type?: string };
  report_submitted: CommonProperties & { entity_type?: string; reason?: string };
}

const COMMON_KEYS = ["platform", "app_version", "source_screen"] as const;
export const ANALYTICS_PROPERTY_ALLOWLIST: {
  readonly [K in AnalyticsEventName]: readonly (keyof AnalyticsEventProperties[K])[];
} = {
  app_opened: COMMON_KEYS,
  registration_started: [...COMMON_KEYS, "method", "referral_present"],
  registration_completed: [...COMMON_KEYS, "method", "role"],
  onboarding_step_viewed: [...COMMON_KEYS, "step", "step_number"],
  onboarding_completed: [...COMMON_KEYS, "steps_completed"],
  community_selected: [...COMMON_KEYS, "community_id"],
  search_performed: [...COMMON_KEYS, "category", "result_count"],
  search_result_opened: [...COMMON_KEYS, "entity_type", "entity_id", "position"],
  post_created: [...COMMON_KEYS, "post_id", "category", "community_id"],
  comment_created: [...COMMON_KEYS, "comment_id", "post_id"],
  business_profile_viewed: [...COMMON_KEYS, "business_id", "category"],
  business_claim_submitted: [...COMMON_KEYS, "business_id"],
  invite_shared: [...COMMON_KEYS, "channel"],
  referral_registration_completed: [...COMMON_KEYS, "inviter_id"],
  notification_opened: [...COMMON_KEYS, "notification_id", "notification_type"],
  report_submitted: [...COMMON_KEYS, "entity_type", "reason"],
};

const SENSITIVE_KEY = /(name|email|phone|address|message|content|description|text|query|password|token|contact)/i;
const SAFE_METADATA_STRING = /^[A-Za-z0-9_.:/-]{1,100}$/;
const PHONE_LIKE_VALUE = /^\+?[\d\s()-]{7,}$/;

export type AnalyticsSanitizeMode = "reject" | "remove";

export function sanitizeAnalyticsProperties<K extends AnalyticsEventName>(
  event: K,
  properties: Record<string, unknown> = {},
  mode: AnalyticsSanitizeMode = "reject",
): AnalyticsEventProperties[K] {
  const allowed = new Set<string>(ANALYTICS_PROPERTY_ALLOWLIST[event] as readonly string[]);
  const sanitized: Record<string, AnalyticsPropertyValue> = {};

  for (const [key, value] of Object.entries(properties)) {
    const invalidKey = SENSITIVE_KEY.test(key) || !allowed.has(key);
    const invalidValue =
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean";
    const unsafeString =
      typeof value === "string" &&
      (!SAFE_METADATA_STRING.test(value) || PHONE_LIKE_VALUE.test(value));
    if (invalidKey || invalidValue || unsafeString) {
      if (mode === "reject") {
        throw new Error(`Unsafe analytics property "${key}" for event "${event}"`);
      }
      continue;
    }
    sanitized[key] = value as AnalyticsPropertyValue;
  }
  return sanitized as AnalyticsEventProperties[K];
}

export const AnalyticsEventSchema = z.object({
  event: AnalyticsEventNameSchema,
  properties: z.record(z.union([z.string().max(100), z.number(), z.boolean(), z.null()])),
  occurred_at: z.string().datetime(),
  anonymous_id: z.string().max(128).optional(),
  session_id: z.string().max(128).optional(),
});

export const AnalyticsEventBatchSchema = z.object({
  events: z.array(AnalyticsEventSchema).min(1).max(100),
});

export const ClientErrorReportSchema = z.object({
  error_code: z.string().max(100),
  error_kind: z.enum(["api", "render", "unhandled_promise", "native", "unknown"]),
  occurred_at: z.string().datetime(),
  platform: z.enum(["web", "ios", "android"]),
  environment: z.string().max(50),
  release: z.string().max(100).optional(),
  route: z.string().max(200).optional(),
  request_id: z.string().max(128).optional(),
  status_code: z.number().int().min(100).max(599).optional(),
  stack_fingerprint: z.string().max(128).optional(),
  anonymous_user_id: z.string().max(128).optional(),
}).strict();

export type AnalyticsEvent<K extends AnalyticsEventName = AnalyticsEventName> = {
  event: K;
  properties: AnalyticsEventProperties[K];
  occurred_at: string;
  anonymous_id?: string;
  session_id?: string;
};
export type AnalyticsEventBatch = z.infer<typeof AnalyticsEventBatchSchema>;
export type ClientErrorReport = z.infer<typeof ClientErrorReportSchema>;
