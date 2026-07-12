import { z } from "zod";

export const FeatureFlagKeySchema = z.enum([
  "invitations",
  "business_claiming",
  "weekly_digest",
  "community_posting",
  "business_reviews",
  "user_registration",
]);
export const FeatureFlagScopeSchema = z.enum(["GLOBAL", "USER", "COMPOUND", "CITY", "NEIGHBOURHOOD"]);

export const FeatureFlagSchema = z.object({
  key: FeatureFlagKeySchema,
  enabled: z.boolean(),
  description: z.string().nullable().optional(),
  updated_at: z.string().datetime().optional(),
});

export const FeatureFlagOverrideSchema = z.object({
  id: z.number().int().positive().optional(),
  key: FeatureFlagKeySchema,
  scope: FeatureFlagScopeSchema,
  scope_id: z.string().min(1).nullable().optional(),
  enabled: z.boolean(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
});

export const FeatureConfigSchema = z.object({
  flags: z.record(FeatureFlagKeySchema, z.boolean()),
  city_enabled: z.boolean().optional(),
  neighbourhood_enabled: z.boolean().optional(),
  fetched_at: z.string().datetime().optional(),
});

export const FeatureFlagUpdateSchema = z.object({
  enabled: z.boolean(),
  description: z.string().trim().max(500).optional(),
});

export type FeatureFlagKey = z.infer<typeof FeatureFlagKeySchema>;
export type FeatureFlagScope = z.infer<typeof FeatureFlagScopeSchema>;
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;
export type FeatureFlagOverride = z.infer<typeof FeatureFlagOverrideSchema>;
export type FeatureConfig = z.infer<typeof FeatureConfigSchema>;
export type FeatureFlagUpdate = z.infer<typeof FeatureFlagUpdateSchema>;
