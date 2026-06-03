import { z } from "zod";

import { appModeSchema } from "./app-modes.js";

export const sessionRefSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  appMode: appModeSchema.default("daily_work"),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type SessionRef = z.infer<typeof sessionRefSchema>;
