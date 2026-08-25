import { z } from "zod";

export const ListingCategorySchema = z.enum([
  "PROPERTY",
  "CAR",
  "ITEM",
  "SERVICE",
]);

export const ListingIntentSchema = z.enum(["SELL", "RENT", "FREE"]);

export const ListingStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "SOLD",
  "RENTED",
  "ARCHIVED",
]);

export const ItemConditionSchema = z.enum(["NEW", "LIKE_NEW", "USED", "FAIR"]);
export const CarTransmissionSchema = z.enum(["AUTOMATIC", "MANUAL"]);
export const CarFuelTypeSchema = z.enum([
  "PETROL",
  "DIESEL",
  "ELECTRIC",
  "HYBRID",
]);
export const PropertyTypeSchema = z.enum([
  "APARTMENT",
  "VILLA",
  "TOWNHOUSE",
  "STUDIO",
  "DUPLEX",
]);
export const FurnishingSchema = z.enum([
  "UNFURNISHED",
  "SEMI_FURNISHED",
  "FURNISHED",
]);

export const ItemAttributesSchema = z
  .object({ condition: ItemConditionSchema })
  .strict();

export const CarAttributesSchema = z
  .object({
    make: z.string().min(1).max(100),
    model: z.string().min(1).max(100),
    year: z.number().int().min(1886).max(new Date().getFullYear() + 1),
    mileage_km: z.number().int().nonnegative(),
    transmission: CarTransmissionSchema,
    fuel_type: CarFuelTypeSchema,
  })
  .strict();

export const PropertyAttributesSchema = z
  .object({
    property_type: PropertyTypeSchema,
    bedrooms: z.number().int().min(0).max(100),
    bathrooms: z.number().int().min(0).max(100),
    area_sqm: z.number().positive(),
    furnishing: FurnishingSchema,
  })
  .strict();

export const ListingAttributesSchema = z.union([
  ItemAttributesSchema,
  CarAttributesSchema,
  PropertyAttributesSchema,
]);

type CategoryAndAttributes = {
  category: z.infer<typeof ListingCategorySchema>;
  intent: z.infer<typeof ListingIntentSchema>;
  price?: number | null;
  attributes?: z.infer<typeof ListingAttributesSchema> | null;
};

const validateCategoryDetails = (
  listing: CategoryAndAttributes,
  ctx: z.RefinementCtx,
) => {
  if (
    (listing.category === "CAR" || listing.category === "ITEM") &&
    listing.intent !== "SELL" &&
    listing.intent !== "FREE"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["intent"],
      message: `${listing.category} listings require SELL intent`,
    });
  }

  if (listing.category === "SERVICE" && listing.intent === "FREE") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["intent"],
      message: "SERVICE listings cannot use FREE intent",
    });
  }

  if (listing.intent === "FREE" && listing.price != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["price"],
      message: "FREE listings must not have a price",
    });
  }

  const attributesMatch =
    listing.attributes == null ||
    (listing.category === "ITEM" &&
      ItemAttributesSchema.safeParse(listing.attributes).success) ||
    (listing.category === "CAR" &&
      CarAttributesSchema.safeParse(listing.attributes).success) ||
    (listing.category === "PROPERTY" &&
      PropertyAttributesSchema.safeParse(listing.attributes).success);

  if (!attributesMatch || (listing.category === "SERVICE" && listing.attributes != null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["attributes"],
      message: `Attributes do not match ${listing.category} category`,
    });
  }
};

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
  attributes: ListingAttributesSchema.nullable().optional(),
  image_urls: z.array(z.string()),
  status: ListingStatusSchema,
  created_at: z.string().datetime(),
  is_saved: z.boolean().optional(),
}).superRefine(validateCategoryDetails);

export const ListingCreateSchema = z.object({
  category: ListingCategorySchema,
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nullable().optional(),
  currency: z.string().default("EGP"),
  intent: ListingIntentSchema,
  attributes: ListingAttributesSchema.nullable().optional(),
  image_urls: z.array(z.string()).default([]),
}).superRefine(validateCategoryDetails);

export const ListingUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  status: ListingStatusSchema.optional(),
  image_urls: z.array(z.string()).optional(),
  attributes: ListingAttributesSchema.nullable().optional(),
}).strict();

export type Listing = z.infer<typeof ListingSchema>;
export type ListingCreate = z.infer<typeof ListingCreateSchema>;
export type ListingUpdate = z.infer<typeof ListingUpdateSchema>;
export type ListingAttributes = z.infer<typeof ListingAttributesSchema>;
export type ItemAttributes = z.infer<typeof ItemAttributesSchema>;
export type CarAttributes = z.infer<typeof CarAttributesSchema>;
export type PropertyAttributes = z.infer<typeof PropertyAttributesSchema>;
export type ListingCategory = z.infer<typeof ListingCategorySchema>;
export type ListingIntent = z.infer<typeof ListingIntentSchema>;
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

