import { z } from "zod";

export const ReportEntityTypeSchema = z.enum(["post", "comment", "business", "user"]);
export const ReportReasonSchema = z.enum([
  "spam",
  "harassment",
  "false_information",
  "inappropriate_content",
  "duplicate_listing",
  "other",
]);
export const ReportStatusSchema = z.enum([
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED",
  "DISMISSED",
]);

export const ReportCreateSchema = z.object({
  reported_type: ReportEntityTypeSchema,
  reported_id: z.number().int().positive(),
  reason: ReportReasonSchema,
  description: z.string().trim().max(2000).optional().nullable(),
});

export const ReportResponseSchema = z.object({
  id: z.number(),
  reporter_id: z.number(),
  reporter_name: z.string().nullable().optional(),
  reported_type: ReportEntityTypeSchema,
  reported_id: z.number(),
  reason: ReportReasonSchema,
  description: z.string().nullable().optional(),
  status: ReportStatusSchema,
  reviewed_by_id: z.number().nullable().optional(),
  reviewed_by_name: z.string().nullable().optional(),
  reviewed_at: z.string().datetime().nullable().optional(),
  review_notes: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const ReportUpdateSchema = z.object({
  status: ReportStatusSchema,
  review_notes: z.string().trim().max(2000).optional().nullable(),
});

export type ReportCreate = z.infer<typeof ReportCreateSchema>;
export type ReportResponse = z.infer<typeof ReportResponseSchema>;
export type ReportEntityType = z.infer<typeof ReportEntityTypeSchema>;
export type ReportReason = z.infer<typeof ReportReasonSchema>;
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
export type ReportUpdate = z.infer<typeof ReportUpdateSchema>;

