import { z } from "zod";

export const BusinessVerificationStatusSchema = z.enum([
  "UNVERIFIED",
  "CLAIMED",
  "VERIFIED",
]);
export const BusinessClaimStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const BusinessMembershipRoleSchema = z.enum(["OWNER", "MANAGER"]);

export const BusinessHoursDaySchema = z.object({
  open: z.string().optional(),
  close: z.string().optional(),
  closed: z.boolean().optional(),
});

export const BusinessHoursSchema = z.record(z.string(), BusinessHoursDaySchema);

export const BusinessOfferCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  badge_text: z.string().trim().max(80).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  is_active: z.boolean().optional(),
});

export const BusinessOfferUpdateSchema = BusinessOfferCreateSchema.partial();

export const BusinessOfferSchema = BusinessOfferCreateSchema.extend({
  id: z.number().int().positive(),
  business_id: z.number().int().positive(),
  description: z.string().nullable().optional(),
  badge_text: z.string().nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  is_active: z.boolean(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const BusinessAnalyticsSchema = z.object({
  profile_views: z.number().int().nonnegative(),
  offer_clicks: z.number().int().nonnegative(),
  active_offers: z.number().int().nonnegative(),
});

export const BusinessSummarySchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  city: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  compound_id: z.number().int().positive().nullable().optional(),
  compound_name: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  verification_status: BusinessVerificationStatusSchema,
  is_active: z.boolean(),
});

export const BusinessDetailSchema = BusinessSummarySchema.extend({
  description: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  website: z.string().url().nullable().optional(),
  hours: BusinessHoursSchema.nullable().optional(),
  is_hidden: z.boolean().optional(),
  user_membership_role: BusinessMembershipRoleSchema.nullable().optional(),
  viewer_membership_role: BusinessMembershipRoleSchema.nullable().optional(),
  current_user_claim_status: BusinessClaimStatusSchema.nullable().optional(),
  profile_views: z.number().int().nonnegative().optional(),
  offers: z.array(BusinessOfferSchema).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const BusinessCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().max(4000).optional(),
  compound_id: z.number().int().positive().optional(),
  city: z.string().trim().max(100).optional(),
  area: z.string().trim().max(100).optional(),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(50).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  image_url: z.string().url().optional(),
  hours: BusinessHoursSchema.optional(),
});

export const BusinessDirectoryResponseSchema = z.object({
  items: z.array(BusinessSummarySchema),
  total: z.number().int().nonnegative(),
  skip: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});

export const BusinessClaimCreateSchema = z.object({
  full_name: z.string().trim().min(2).max(200),
  relationship_role: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(5).max(50),
  email: z.string().email(),
  supporting_information: z.string().trim().max(4000).optional(),
  supporting_info: z.string().trim().max(5000).optional(),
  supporting_documents: z.array(z.string()).max(20).optional(),
  requested_role: BusinessMembershipRoleSchema.default("OWNER"),
});

export const BusinessClaimSchema = BusinessClaimCreateSchema.extend({
  id: z.number().int().positive(),
  business_id: z.number().int().positive(),
  business_slug: z.string().optional(),
  business_name: z.string().optional(),
  business_verification_status: BusinessVerificationStatusSchema.optional(),
  public_status: z.string().optional(),
  claimant_user_id: z.number().int().positive().optional(),
  claimant_id: z.number().int().positive().nullable().optional(),
  status: BusinessClaimStatusSchema,
  submitted_at: z.string().datetime(),
  reviewed_at: z.string().datetime().nullable().optional(),
  reviewed_by_id: z.number().int().positive().nullable().optional(),
  reviewer_id: z.number().int().positive().nullable().optional(),
  review_notes: z.string().nullable().optional(),
});

export const BusinessClaimReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  review_notes: z.string().trim().max(2000).optional(),
  membership_role: BusinessMembershipRoleSchema.optional(),
});

export const BusinessMembershipSchema = z.object({
  id: z.number().int().positive(),
  business_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  role: BusinessMembershipRoleSchema,
  created_at: z.string().datetime(),
});

export const AdminBusinessUpdateSchema = BusinessCreateSchema.partial().extend({
  verification_status: BusinessVerificationStatusSchema.optional(),
  is_active: z.boolean().optional(),
  is_hidden: z.boolean().optional(),
});

export type BusinessHoursDay = z.infer<typeof BusinessHoursDaySchema>;
export type BusinessHours = z.infer<typeof BusinessHoursSchema>;
export type BusinessVerificationStatus = z.infer<typeof BusinessVerificationStatusSchema>;
export type BusinessClaimStatus = z.infer<typeof BusinessClaimStatusSchema>;
export type BusinessMembershipRole = z.infer<typeof BusinessMembershipRoleSchema>;
export type BusinessSummary = z.infer<typeof BusinessSummarySchema>;
export type BusinessDetail = z.infer<typeof BusinessDetailSchema>;
export type BusinessCreate = z.infer<typeof BusinessCreateSchema>;
export type BusinessDirectoryResponse = z.infer<typeof BusinessDirectoryResponseSchema>;
export type BusinessClaimCreate = z.infer<typeof BusinessClaimCreateSchema>;
export type BusinessClaim = z.infer<typeof BusinessClaimSchema>;
export type BusinessClaimReview = z.infer<typeof BusinessClaimReviewSchema>;
export type BusinessMembership = z.infer<typeof BusinessMembershipSchema>;
export type AdminBusinessUpdate = z.infer<typeof AdminBusinessUpdateSchema>;
export type BusinessOffer = z.infer<typeof BusinessOfferSchema>;
export type BusinessOfferCreate = z.infer<typeof BusinessOfferCreateSchema>;
export type BusinessOfferUpdate = z.infer<typeof BusinessOfferUpdateSchema>;
export type BusinessAnalytics = z.infer<typeof BusinessAnalyticsSchema>;
