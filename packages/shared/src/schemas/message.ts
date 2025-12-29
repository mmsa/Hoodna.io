import { z } from "zod";

export const MessageCreateSchema = z.object({
  recipient_id: z.number(),
  listing_id: z.number().optional(),
});

export const MessageResponseSchema = z.object({
  id: z.number(),
  conversation_id: z.number(),
  sender_id: z.number(),
  sender_name: z.string(),
  content: z.string(),
  created_at: z.string().datetime(),
});

export const ConversationResponseSchema = z.object({
  id: z.number(),
  user1_id: z.number(),
  user2_id: z.number(),
  listing_id: z.number().nullable().optional(),
  listing_title: z.string().nullable().optional(),
  other_user_id: z.number(),
  other_user_name: z.string(),
  other_user_email: z.string().nullable().optional(),
  last_message: MessageResponseSchema.nullable().optional(),
  unread_count: z.number(),
  created_at: z.string().datetime(),
});

export const ConversationDetailResponseSchema = z.object({
  id: z.number(),
  user1_id: z.number(),
  user2_id: z.number(),
  listing_id: z.number().nullable().optional(),
  listing_title: z.string().nullable().optional(),
  other_user_id: z.number(),
  other_user_name: z.string(),
  other_user_email: z.string().nullable().optional(),
  messages: z.array(MessageResponseSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type MessageCreate = z.infer<typeof MessageCreateSchema>;
export type MessageResponse = z.infer<typeof MessageResponseSchema>;
export type ConversationResponse = z.infer<typeof ConversationResponseSchema>;
export type ConversationDetailResponse = z.infer<typeof ConversationDetailResponseSchema>;

