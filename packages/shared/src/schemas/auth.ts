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
  email: z.string().email(),
  password: z.string(),
});

export const UserSignupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  role: z.enum(['RESIDENT', 'SERVICE_PROVIDER', 'COMPOUND_MOD']),
});

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordRequestSchema = z.object({
  token: z.string(),
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

