import { z } from "zod";

export const DocumentTypeSchema = z.enum(["NATIONAL_ID", "CONTRACT"]);

export const DocumentStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "REQUEST_MORE_DETAILS",
]);

export const VerificationDocumentSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  compound_id: z.number().nullable().optional(),
  type: DocumentTypeSchema,
  file_url: z.string(),
  status: DocumentStatusSchema,
  reviewer_id: z.number().nullable(),
  notes: z.string().nullable(),
  llm_verified: z.boolean().nullable(),
  llm_confidence: z.number().nullable(),
  llm_recommendation: z.string().nullable(),
  llm_reasoning: z.string().nullable(),
  llm_issues: z.array(z.string()).nullable(),
  llm_extracted_info: z.record(z.any()).nullable(),
  llm_verified_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

export const VerificationStatusResponseSchema = z.object({
  national_id: VerificationDocumentSchema.nullable(),
  contract: VerificationDocumentSchema.nullable(),
  user_status: z.string(),
  can_post: z.boolean(),
  compound_id: z.number().nullable().optional(),
  compound_name: z.string().nullable().optional(),
});

export const PresignRequestSchema = z.object({
  file_name: z.string(),
  file_type: z.string(),
  document_type: DocumentTypeSchema,
});

export const PresignResponseSchema = z.object({
  presigned_url: z.string(),
  file_url: z.string(),
});

export const DocumentSubmitSchema = z.object({
  file_url: z.string(),
  document_type: DocumentTypeSchema,
});

export type VerificationDocument = z.infer<typeof VerificationDocumentSchema>;
export type VerificationStatusResponse = z.infer<typeof VerificationStatusResponseSchema>;
export type PresignRequest = z.infer<typeof PresignRequestSchema>;
export type PresignResponse = z.infer<typeof PresignResponseSchema>;
export type DocumentSubmit = z.infer<typeof DocumentSubmitSchema>;
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

