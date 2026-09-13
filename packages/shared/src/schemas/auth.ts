import { z } from "zod";

/**
 * Must match the server policy in backend/app/schemas/auth.py. A client
 * minimum below the server's produces a 422 the user cannot act on.
 */
export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt only hashes the first 72 bytes, so longer input is rejected outright. */
export const MAX_PASSWORD_LENGTH = 72;

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH, `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer`);

export const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string().default("bearer"),
});

export const PhoneAuthStartRequestSchema = z.object({
  phone: z.string(),
});

export const PhoneAuthStartResponseSchema = z.object({
  message: z.string(),
  otp_code: z.string().optional(),
});

export const RegistrationPlatformSchema = z.enum(["web", "ios", "android"]);

export const AttributionPayloadSchema = z
  .object({
    source: z.string().trim().max(100).optional().nullable(),
    medium: z.string().trim().max(100).optional().nullable(),
    campaign: z.string().trim().max(100).optional().nullable(),
    content: z.string().trim().max(100).optional().nullable(),
    term: z.string().trim().max(100).optional().nullable(),
    referrer_host: z.string().trim().max(100).optional().nullable(),
    landing_path: z.string().trim().max(100).optional().nullable(),
  })
  .optional();

export const PhoneAuthVerifyRequestSchema = z.object({
  phone: z.string(),
  otp_code: z.string(),
  name: z.string().optional(),
  referral_code: z.string().trim().min(4).max(64).optional(),
  platform: RegistrationPlatformSchema.optional(),
  attribution: AttributionPayloadSchema,
});

export const UserLoginSchema = z.object({
  /** Email address or mobile phone number */
  email: z.string().min(3, "Enter your email or phone number"),
  // Deliberately not held to the signup policy: accounts created before it
  // still have shorter passwords and must be able to sign in.
  password: z.string().min(1, "Enter your password"),
});

export const UserSignupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().min(7, "Phone number is required"),
  password: passwordSchema,
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  // Optional: the role is chosen after sign-up on the choose-role step, and the
  // server accepts a null role for exactly that flow.
  role: z.enum(["RESIDENT", "SERVICE_PROVIDER", "COMPOUND_MOD"]).optional(),
  referral_code: z.string().trim().min(4).max(64).optional(),
  platform: RegistrationPlatformSchema.optional(),
  attribution: AttributionPayloadSchema,
});

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordRequestSchema = z.object({
  token: z.string(),
  new_password: passwordSchema,
});

export const ResetPasswordPhoneRequestSchema = z.object({
  phone: z.string().min(7),
  otp_code: z.string().min(4).max(12),
  new_password: passwordSchema,
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type PhoneAuthStartRequest = z.infer<typeof PhoneAuthStartRequestSchema>;
export type PhoneAuthStartResponse = z.infer<typeof PhoneAuthStartResponseSchema>;
export type PhoneAuthVerifyRequest = z.infer<typeof PhoneAuthVerifyRequestSchema>;
export type UserLogin = z.infer<typeof UserLoginSchema>;
export type UserSignup = z.infer<typeof UserSignupSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export type ResetPasswordPhoneRequest = z.infer<typeof ResetPasswordPhoneRequestSchema>;

