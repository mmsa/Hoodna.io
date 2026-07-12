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
  actor_type: AuditActorTypeSchema,
  actor_id: z.number().int().positive().nullable().optional(),
  action: z.string(),
  target_type: z.string().nullable().optional(),
  target_id: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
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
