import { z } from "zod";
import { BusinessSummarySchema } from "./business";

export const DigestPostItemSchema = z.object({
  id: z.number().int().positive(),
  category: z.string().optional(),
  author_name: z.string().optional(),
  created_at: z.string().datetime(),
});

export const DigestSummarySchema = z.object({
  id: z.number().int().positive().optional(),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  popular_posts: z.array(DigestPostItemSchema),
  new_businesses: z.array(BusinessSummarySchema),
  announcements: z.array(DigestPostItemSchema),
  recommended_local_activity: z.array(
    z.object({
      entity_type: z.enum(["post", "business", "listing", "event"]),
      entity_id: z.number().int().positive(),
      category: z.string().optional(),
    }),
  ),
  generated_at: z.string().datetime(),
  notification_id: z.number().int().positive().nullable().optional(),
});

export type DigestPostItem = z.infer<typeof DigestPostItemSchema>;
export type DigestSummary = z.infer<typeof DigestSummarySchema>;
