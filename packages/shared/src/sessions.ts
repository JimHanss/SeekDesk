import { z } from "zod";

export const sessionRefSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type SessionRef = z.infer<typeof sessionRefSchema>;
