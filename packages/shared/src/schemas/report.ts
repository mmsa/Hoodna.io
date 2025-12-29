import { z } from "zod";

export const ReportCreateSchema = z.object({
  reported_type: z.enum(["post", "listing", "comment", "user"]),
  reported_id: z.number(),
  reason: z.enum(["spam", "inappropriate", "scam", "harassment", "fake", "other"]),
  description: z.string().optional().nullable(),
});

export const ReportResponseSchema = z.object({
  id: z.number(),
  reporter_id: z.number(),
  reporter_name: z.string().nullable().optional(),
  reported_type: z.string(),
  reported_id: z.number(),
  reason: z.string(),
  description: z.string().nullable().optional(),
  status: z.string(),
  reviewed_by_id: z.number().nullable().optional(),
  reviewed_by_name: z.string().nullable().optional(),
  reviewed_at: z.string().datetime().nullable().optional(),
  review_notes: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ReportCreate = z.infer<typeof ReportCreateSchema>;
export type ReportResponse = z.infer<typeof ReportResponseSchema>;

