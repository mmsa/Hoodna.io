import { z } from "zod";

export const ListingCategorySchema = z.enum([
  "PROPERTY",
  "CAR",
  "ITEM",
  "SERVICE",
]);

export const ListingIntentSchema = z.enum(["SELL", "RENT"]);

export const ListingStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "SOLD",
  "RENTED",
  "ARCHIVED",
]);

export const ListingSchema = z.object({
  id: z.number(),
  compound_id: z.number(),
  compound_name: z.string(),
  owner_id: z.number(),
  owner_name: z.string(),
  owner_email: z.string().email().nullable().optional(),
  owner_phone: z.string().nullable().optional(),
  category: ListingCategorySchema,
  title: z.string(),
  description: z.string().nullable(),
  price: z.number().nullable(),
  currency: z.string(),
  intent: ListingIntentSchema,
  image_urls: z.array(z.string()),
  status: ListingStatusSchema,
  created_at: z.string().datetime(),
  is_saved: z.boolean().optional(),
});

export const ListingCreateSchema = z.object({
  category: ListingCategorySchema,
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nullable().optional(),
  currency: z.string().default("EGP"),
  intent: ListingIntentSchema,
  image_urls: z.array(z.string()).default([]),
});

export type Listing = z.infer<typeof ListingSchema>;
export type ListingCreate = z.infer<typeof ListingCreateSchema>;
export type ListingCategory = z.infer<typeof ListingCategorySchema>;
export type ListingIntent = z.infer<typeof ListingIntentSchema>;
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

