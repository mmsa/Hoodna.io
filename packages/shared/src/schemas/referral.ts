import { z } from "zod";

export const ReferralInviteStatusSchema = z.enum([
  "PENDING",
  "REGISTERED",
  "EXPIRED",
  "REVOKED",
]);

export const ReferralRewardStatusSchema = z.enum([
  "NOT_APPLICABLE",
  "PENDING",
  "GRANTED",
]);

export const ReferralInviteSchema = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  inviter_id: z.number().int().positive(),
  accepted_user_id: z.number().int().positive().nullable().optional(),
  status: ReferralInviteStatusSchema,
  reward_status: ReferralRewardStatusSchema.optional(),
  created_at: z.string().datetime(),
  registered_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  invite_url: z.string().url().optional(),
});

export const ReferralMeSchema = z.object({
  code: z.string(),
  invite_url: z.string().url(),
  invite: ReferralInviteSchema.optional(),
});

export const ReferralStatsSchema = z.object({
  invitations_sent: z.number().int().nonnegative(),
  successful_registrations: z.number().int().nonnegative(),
});

export const ReferralCreateSchema = z.object({
  source: z.enum(["profile", "settings", "community", "other"]).optional(),
});

export const ReferralRedeemSchema = z.object({
  code: z.string().trim().min(4).max(64),
});

export const ReferralRedeemResponseSchema = z.object({
  redeemed: z.boolean(),
  invite: ReferralInviteSchema,
});

export type ReferralInviteStatus = z.infer<typeof ReferralInviteStatusSchema>;
export type ReferralRewardStatus = z.infer<typeof ReferralRewardStatusSchema>;
export type ReferralInvite = z.infer<typeof ReferralInviteSchema>;
export type ReferralMe = z.infer<typeof ReferralMeSchema>;
export type ReferralStats = z.infer<typeof ReferralStatsSchema>;
export type ReferralCreate = z.infer<typeof ReferralCreateSchema>;
export type ReferralRedeem = z.infer<typeof ReferralRedeemSchema>;
export type ReferralRedeemResponse = z.infer<typeof ReferralRedeemResponseSchema>;
