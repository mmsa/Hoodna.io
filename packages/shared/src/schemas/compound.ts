import { z } from "zod";

export const CompoundSchema = z.object({
  id: z.number(),
  name: z.string(),
  area: z.string().nullable(),
  developer: z.string().nullable(),
  status_2025: z.string().nullable(),
  category: z.string().nullable(),
});

export type Compound = z.infer<typeof CompoundSchema>;

