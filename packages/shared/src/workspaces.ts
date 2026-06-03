import { z } from "zod";

import { appModeSchema } from "./app-modes.js";

export const workspaceRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootPath: z.string(),
  mode: z.enum(["local_daemon", "cloud_workspace"]),
  defaultAppMode: appModeSchema.default("daily_work"),
  connected: z.boolean(),
  createdAt: z.string()
});

export type WorkspaceRef = z.infer<typeof workspaceRefSchema>;
