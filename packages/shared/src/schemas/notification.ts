import { z } from "zod";

export const NotificationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  read: z.boolean(),
  read_at: z.string().datetime().nullable().optional(),
  related_id: z.number().nullable().optional(),
  related_type: z.string().nullable().optional(),
  extra_data: z.record(z.unknown()).nullable().optional(),
  created_at: z.string().datetime(),
});

export const NotificationListResponseSchema = z.object({
  items: z.array(NotificationSchema),
  total: z.number(),
  unread_count: z.number(),
  skip: z.number(),
  limit: z.number(),
});

export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;

