import { z } from "zod";

export const appModeSchema = z.enum(["daily_work", "coding_agent"]);

export const appModeStatusSchema = z.enum([
  "active",
  "reserved",
  "disabled"
]);

export const appModeDescriptorSchema = z.object({
  id: appModeSchema,
  label: z.string(),
  status: appModeStatusSchema,
  description: z.string()
});

export type AppMode = z.infer<typeof appModeSchema>;
export type AppModeStatus = z.infer<typeof appModeStatusSchema>;
export type AppModeDescriptor = z.infer<typeof appModeDescriptorSchema>;
