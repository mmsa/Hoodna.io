import { z } from "zod";

export const UserRoleSchema = z.enum(["USER", "ADMIN", "MODERATOR"]);

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
  role: UserRoleSchema,
  status: UserStatusSchema,
  compound_id: z.number().nullable(),
  created_at: z.string().datetime(),
  verification_status: VerificationStatusSchema.nullable(),
  can_post: z.boolean().nullable(),
  can_comment: z.boolean().nullable(),
  can_create_listing: z.boolean().nullable(),
});

export type User = z.infer<typeof UserSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type UserStatus = z.infer<typeof UserStatusSchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

