import { z } from "zod";

export const SupportedLocaleSchema = z.enum(["en", "ar"]);

export const UserPreferencesSchema = z.object({
  push_notifications: z.boolean(),
  weekly_digest: z.boolean(),
  community_announcements: z.boolean(),
  business_recommendations: z.boolean(),
  locale: SupportedLocaleSchema.default("en"),
  updated_at: z.string().datetime().optional(),
});

export const UserPreferencesUpdateSchema = UserPreferencesSchema.omit({
  updated_at: true,
}).partial();

export const AccountDeletionRequestCreateSchema = z.object({
  confirmation: z.literal("DELETE"),
  reason: z.string().trim().max(1000).optional(),
});

export const AccountDeletionRequestSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "CANCELLED"]),
  requested_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable().optional(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UserPreferencesUpdate = z.infer<typeof UserPreferencesUpdateSchema>;
export type SupportedLocale = z.infer<typeof SupportedLocaleSchema>;
export type AccountDeletionRequestCreate = z.infer<typeof AccountDeletionRequestCreateSchema>;
export type AccountDeletionRequest = z.infer<typeof AccountDeletionRequestSchema>;
