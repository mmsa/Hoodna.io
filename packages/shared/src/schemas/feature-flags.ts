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
  id: z.number().int().positive().optional(),
  key: FeatureFlagKeySchema,
  enabled: z.boolean(),
  description: z.string().nullable().optional(),
  config: z.record(z.unknown()).default({}),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const FeatureFlagOverrideSchema = z.object({
  id: z.number().int().positive().optional(),
  feature_flag_id: z.number().int().positive().optional(),
  key: FeatureFlagKeySchema.optional(),
  scope: z.enum(["USER", "COMPOUND", "CITY"]),
  scope_id: z.string().min(1).nullable().optional(),
  target_key: z.string().optional(),
  user_id: z.number().int().positive().nullable().optional(),
  compound_id: z.number().int().positive().nullable().optional(),
  city: z.string().nullable().optional(),
  enabled: z.boolean(),
  config: z.record(z.unknown()).default({}),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const FeatureConfigSchema = z.object({
  flags: z.record(FeatureFlagKeySchema, z.boolean()),
  city_enabled: z.boolean().optional(),
  neighbourhood_enabled: z.boolean().optional(),
  fetched_at: z.string().datetime().optional(),
});

export const FeatureFlagUpdateSchema = z.object({
  enabled: z.boolean(),
  description: z.string().trim().max(500).nullable().optional(),
  config: z.record(z.unknown()).default({}),
});

export type FeatureFlagKey = z.infer<typeof FeatureFlagKeySchema>;
export type FeatureFlagScope = z.infer<typeof FeatureFlagScopeSchema>;
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;
export type FeatureFlagOverride = z.infer<typeof FeatureFlagOverrideSchema>;
export type FeatureConfig = z.infer<typeof FeatureConfigSchema>;
export type FeatureFlagUpdate = z.infer<typeof FeatureFlagUpdateSchema>;
