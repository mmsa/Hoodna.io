import { z } from "zod";

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

export const PhoneAuthVerifyRequestSchema = z.object({
  phone: z.string(),
  otp_code: z.string(),
  name: z.string().optional(),
});

export const UserLoginSchema = z.object({
  /** Email address or mobile phone number */
  email: z.string().min(3, "Enter your email or phone number"),
  password: z.string().min(6),
});

export const UserSignupSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(7, "Phone number is required"),
  password: z.string().min(6),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  role: z.enum(['RESIDENT', 'SERVICE_PROVIDER', 'COMPOUND_MOD']),
  referral_code: z.string().trim().min(4).max(64).optional(),
});

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordRequestSchema = z.object({
  token: z.string(),
  new_password: z.string().min(6),
});

export const ResetPasswordPhoneRequestSchema = z.object({
  phone: z.string().min(7),
  otp_code: z.string().min(4).max(12),
  new_password: z.string().min(6),
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

