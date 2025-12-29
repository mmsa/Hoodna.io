import { z } from "zod";

export const CommentSchema = z.object({
  id: z.number(),
  post_id: z.number(),
  author_id: z.number(),
  author_name: z.string(),
  content: z.string(),
  created_at: z.string().datetime(),
});

export const PostSchema = z.object({
  id: z.number(),
  compound_id: z.number(),
  author_id: z.number(),
  author_name: z.string(),
  content: z.string(),
  created_at: z.string().datetime(),
  comments: z.array(CommentSchema),
});

export const PostCreateSchema = z.object({
  content: z.string().min(1),
});

export const CommentCreateSchema = z.object({
  content: z.string().min(1),
});

export type Post = z.infer<typeof PostSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type PostCreate = z.infer<typeof PostCreateSchema>;
export type CommentCreate = z.infer<typeof CommentCreateSchema>;

