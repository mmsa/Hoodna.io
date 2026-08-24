import { z } from "zod";

export const ServiceCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ServiceCategory = z.infer<typeof ServiceCategorySchema>;
