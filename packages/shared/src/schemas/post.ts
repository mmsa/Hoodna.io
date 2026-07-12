import { z } from "zod";

export const CommentSchema = z.object({
  id: z.number(),
  post_id: z.number(),
  author_id: z.number(),
  author_name: z.string(),
  author_status: z.string().optional(), // User status (APPROVED, PENDING, etc.) - for verified badge
  content: z.string(),
  created_at: z.string().datetime(),
});

export const PostCategorySchema = z.enum([
  "GENERAL",
  "HELP",
  "LOST_FOUND",
  "EVENT",
  "MARKETPLACE",
  "ANNOUNCEMENT",
  "ALERT",
  "DISCUSSION",
]);

export const PostSchema = z.object({
  id: z.number(),
  compound_id: z.number(),
  compound_name: z.string().optional(), // Compound name for context
  author_id: z.number(),
  author_name: z.string(),
  author_status: z.string().optional(), // User status (APPROVED, PENDING, etc.) - for verified badge
  content: z.string(),
  category: z.string().optional(), // Post category (GENERAL, HELP, etc.)
  is_urgent: z.boolean().optional(), // Urgent flag for alerts
  created_at: z.string().datetime(),
  comments: z.array(CommentSchema),
  reaction_counts: z.record(z.string(), z.number()).optional(),
  user_reaction: z.string().nullable().optional(),
});

export const PostCreateSchema = z.object({
  content: z.string().min(1),
  category: PostCategorySchema.optional().default("GENERAL"),
  is_urgent: z.boolean().optional().default(false),
});

export const CommentCreateSchema = z.object({
  content: z.string().min(1),
});

export type Post = z.infer<typeof PostSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type PostCreate = z.infer<typeof PostCreateSchema>;
export type CommentCreate = z.infer<typeof CommentCreateSchema>;

