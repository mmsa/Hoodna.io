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

export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type PhoneAuthStartRequest = z.infer<typeof PhoneAuthStartRequestSchema>;
export type PhoneAuthStartResponse = z.infer<typeof PhoneAuthStartResponseSchema>;
export type PhoneAuthVerifyRequest = z.infer<typeof PhoneAuthVerifyRequestSchema>;

