import { z } from "zod";

export const UserRoleSchema = z.enum([
  "USER",           // Legacy - same as RESIDENT
  "ADMIN", 
  "MODERATOR",      // Legacy - use COMPOUND_MOD
  "RESIDENT",       // Explicit resident role
  "SERVICE_PROVIDER",
  "COMPOUND_MOD"
]);

export const UserStatusSchema = z.enum([
  "PENDING_VERIFICATION",
  "APPROVED",
  "REJECTED",
  "BANNED",
]);

export const VerificationStatusSchema = z.enum([
  "UNVERIFIED",
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  avatar_url: z.string().nullable().optional(),
  role: UserRoleSchema,
  status: UserStatusSchema,
  compound_id: z.number().nullable(),
  created_at: z.string().datetime(),
  verification_status: VerificationStatusSchema.nullable(),
  can_post: z.boolean().nullable(),
  can_comment: z.boolean().nullable(),
  can_create_listing: z.boolean().nullable(),
  verified_compound_ids: z.array(z.number()).nullable().optional(),
  is_verified_for_current_compound: z.boolean().nullable().optional(),
  needs_profile_setup: z.boolean().nullable().optional(),
  creation_source: z.string().nullable().optional(),
  needs_imported_content_choice: z.boolean().nullable().optional(),
  imported_content_choice: z.string().nullable().optional(),
});

export type User = z.infer<typeof UserSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type UserStatus = z.infer<typeof UserStatusSchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

