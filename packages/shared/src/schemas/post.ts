import { z } from "zod";

export const CommentSchema = z.object({
  id: z.number(),
  post_id: z.number(),
  author_id: z.number(),
  author_name: z.string(),
  author_avatar_url: z.string().nullable().optional(),
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
  "POLL",
]);

export const PollOptionInputSchema = z.object({
  id: z.number().int().positive().optional(),
  label: z.string().trim().min(1).max(200),
});

export const PollCreateSchema = z.object({
  question: z.string().trim().min(1).max(500).optional(),
  options: z.array(PollOptionInputSchema).min(2).max(4),
});

export const PollOptionSchema = z.object({
  id: z.number().int().positive(),
  label: z.string(),
  votes: z.number().int().nonnegative(),
});

export const PollSchema = z.object({
  question: z.string(),
  options: z.array(PollOptionSchema).min(2).max(4),
  total_votes: z.number().int().nonnegative(),
  user_vote: z.number().int().positive().nullable(),
});

export const PostSchema = z.object({
  id: z.number(),
  compound_id: z.number(),
  compound_name: z.string().optional(), // Compound name for context
  author_id: z.number(),
  author_name: z.string(),
  author_avatar_url: z.string().nullable().optional(),
  author_status: z.string().optional(), // User status (APPROVED, PENDING, etc.) - for verified badge
  content: z.string(),
  category: z.string().optional(), // Post category (GENERAL, HELP, etc.)
  is_urgent: z.boolean().optional(), // Urgent flag for alerts
  created_at: z.string().datetime(),
  comments: z.array(CommentSchema),
  reaction_counts: z.record(z.string(), z.number()).optional(),
  user_reaction: z.string().nullable().optional(),
  poll: PollSchema.nullable().optional(),
  is_saved: z.boolean().optional(),
});

export const PostCreateSchema = z.object({
  content: z.string().min(1),
  category: PostCategorySchema.optional().default("GENERAL"),
  is_urgent: z.boolean().optional().default(false),
  poll: PollCreateSchema.optional(),
}).superRefine((post, ctx) => {
  if (post.category === "POLL" && !post.poll) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["poll"],
      message: "Poll details are required for POLL posts",
    });
  }
  if (post.category !== "POLL" && post.poll) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["poll"],
      message: "Poll details are only allowed for POLL posts",
    });
  }
});

export const CommentCreateSchema = z.object({
  content: z.string().min(1),
});

export type Post = z.infer<typeof PostSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type PostCreate = z.infer<typeof PostCreateSchema>;
export type CommentCreate = z.infer<typeof CommentCreateSchema>;
export type Poll = z.infer<typeof PollSchema>;
export type PollCreate = z.infer<typeof PollCreateSchema>;

