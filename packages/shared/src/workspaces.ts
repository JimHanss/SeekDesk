import { z } from "zod";

export const workspaceRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootPath: z.string(),
  mode: z.enum(["local_daemon", "cloud_workspace"]),
  connected: z.boolean(),
  createdAt: z.string()
});

export type WorkspaceRef = z.infer<typeof workspaceRefSchema>;
