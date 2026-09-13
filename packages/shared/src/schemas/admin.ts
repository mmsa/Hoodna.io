import { z } from "zod";

export const BetaMetricPointSchema = z.object({
  date: z.string(),
  value: z.number().nonnegative(),
});

export const AdminBetaMetricsSchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
  total_registered_users: z.number().int().nonnegative(),
  new_users_by_day: z.array(BetaMetricPointSchema),
  onboarding_completion_rate: z.number().min(0).max(1),
  active_users: z.number().int().nonnegative(),
  posts_created: z.number().int().nonnegative(),
  comments_created: z.number().int().nonnegative(),
  searches_performed: z.number().int().nonnegative(),
  business_claims: z.number().int().nonnegative(),
  reports_awaiting_review: z.number().int().nonnegative(),
  invitations_sent: z.number().int().nonnegative(),
  successful_referrals: z.number().int().nonnegative(),
  client_errors: z.number().int().nonnegative(),
});

export const AuditActorTypeSchema = z.enum(["USER", "ADMIN", "MODERATOR", "SYSTEM"]);
export const AdminAuditEntrySchema = z.object({
  id: z.number().int().positive(),
  actor_type: AuditActorTypeSchema.optional(),
  actor_id: z.number().int().positive().nullable().optional(),
  action: z.string().optional(),
  event_type: z.string().optional(),
  target_type: z.string().nullable().optional(),
  target_id: z.number().int().positive().nullable().optional(),
  entity_type: z.string().nullable().optional(),
  entity_id: z.string().nullable().optional(),
  request_id: z.string().nullable().optional(),
  ip_address: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  data: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
});

export const AdminAuditListSchema = z.object({
  items: z.array(AdminAuditEntrySchema),
  total: z.number().int().nonnegative(),
  skip: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});

export type BetaMetricPoint = z.infer<typeof BetaMetricPointSchema>;
export type AdminBetaMetrics = z.infer<typeof AdminBetaMetricsSchema>;
export type AuditActorType = z.infer<typeof AuditActorTypeSchema>;
export type AdminAuditEntry = z.infer<typeof AdminAuditEntrySchema>;
export type AdminAuditList = z.infer<typeof AdminAuditListSchema>;

export const GrowthBreakdownRowSchema = z.object({
  key: z.string(),
  registrations: z.number().int().nonnegative(),
  verified: z.number().int().nonnegative(),
  activated: z.number().int().nonnegative(),
  wavr: z.number().int().nonnegative(),
});

export const AdminGrowthMetricsSchema = z.object({
  week_start: z.string(),
  week_end: z.string(),
  as_of: z.string(),
  total_registrations: z.number().int().nonnegative(),
  verified_residents: z.number().int().nonnegative(),
  activated_verified_residents: z.number().int().nonnegative(),
  activation_rate: z.number().min(0).max(1),
  wavr: z.number().int().nonnegative(),
  wau: z.number().int().nonnegative(),
  mau: z.number().int().nonnegative(),
  active_compounds: z.number().int().nonnegative(),
  referral_registrations: z.number().int().nonnegative(),
  referral_share: z.number().min(0).max(1),
  d7_eligible: z.number().int().nonnegative(),
  d7_returned: z.number().int().nonnegative(),
  d7_return_rate: z.number().min(0).max(1),
  d30_eligible: z.number().int().nonnegative(),
  d30_returned: z.number().int().nonnegative(),
  d30_return_rate: z.number().min(0).max(1),
  by_source: z.array(GrowthBreakdownRowSchema),
  by_campaign: z.array(GrowthBreakdownRowSchema),
  by_platform: z.array(GrowthBreakdownRowSchema),
  by_compound: z.array(GrowthBreakdownRowSchema),
});

export type GrowthBreakdownRow = z.infer<typeof GrowthBreakdownRowSchema>;
export type AdminGrowthMetrics = z.infer<typeof AdminGrowthMetricsSchema>;
