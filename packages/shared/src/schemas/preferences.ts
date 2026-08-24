import { z } from "zod";

export const SupportedLocaleSchema = z.enum(["en", "ar"]);

export const ProfileVisibilitySchema = z.object({
  show_avatar: z.boolean().default(true),
  show_compound: z.boolean().default(true),
  show_joined_at: z.boolean().default(true),
  show_phone: z.boolean().default(false),
  show_email: z.boolean().default(false),
});

export const UserPreferencesSchema = z.object({
  push_notifications: z.boolean(),
  weekly_digest: z.boolean(),
  community_announcements: z.boolean(),
  business_recommendations: z.boolean(),
  locale: SupportedLocaleSchema.default("en"),
  profile_visibility: ProfileVisibilitySchema.default({
    show_avatar: true,
    show_compound: true,
    show_joined_at: true,
    show_phone: false,
    show_email: false,
  }),
  updated_at: z.string().optional().nullable(),
});

export const UserPreferencesUpdateSchema = UserPreferencesSchema.omit({
  updated_at: true,
}).partial();

export const PublicUserProfileSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  avatar_url: z.string().nullable().optional(),
  compound_id: z.number().int().nullable().optional(),
  compound_name: z.string().nullable().optional(),
  joined_at: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  is_verified: z.boolean(),
  role: z.string().nullable().optional(),
  is_own_profile: z.boolean(),
  visibility: ProfileVisibilitySchema,
});

export const AccountDeletionRequestCreateSchema = z.object({
  confirmation: z.literal("DELETE"),
  reason: z.string().trim().max(1000).optional(),
});

export const AccountDeletionRequestSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "CANCELLED"]),
  requested_at: z.string(),
  completed_at: z.string().nullable().optional(),
});

export type ProfileVisibility = z.infer<typeof ProfileVisibilitySchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UserPreferencesUpdate = z.infer<typeof UserPreferencesUpdateSchema>;
export type PublicUserProfile = z.infer<typeof PublicUserProfileSchema>;
export type SupportedLocale = z.infer<typeof SupportedLocaleSchema>;
export type AccountDeletionRequestCreate = z.infer<typeof AccountDeletionRequestCreateSchema>;
export type AccountDeletionRequest = z.infer<typeof AccountDeletionRequestSchema>;
