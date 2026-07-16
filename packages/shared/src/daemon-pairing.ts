import { z } from "zod";

export const daemonPairingCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/, "Invalid daemon pairing code.");

export const daemonPairingStatusSchema = z.enum([
  "pending",
  "claimed",
  "expired"
]);

export const daemonPairingApiUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Daemon pairing API URL must use HTTP or HTTPS.");

export const daemonPairingCreateRequestSchema = z.object({
  apiUrl: daemonPairingApiUrlSchema
});

export const daemonPairingDeviceSchema = z.object({
  daemonId: z.string().trim().min(1).max(160),
  machineName: z.string().trim().min(1).max(160),
  platform: z.string().trim().min(1).max(80)
});

export const daemonPairingCreateResponseSchema = z.object({
  pairingId: z.string().uuid(),
  code: daemonPairingCodeSchema,
  status: z.literal("pending"),
  apiUrl: daemonPairingApiUrlSchema,
  deepLink: z.string().url(),
  expiresAt: z.string().datetime()
});

export const daemonPairingStatusResponseSchema = z.object({
  pairingId: z.string().uuid(),
  status: daemonPairingStatusSchema,
  expiresAt: z.string().datetime(),
  claimedAt: z.string().datetime().optional(),
  device: daemonPairingDeviceSchema.optional()
});

export const daemonPairingClaimRequestSchema = daemonPairingDeviceSchema.extend({
  code: daemonPairingCodeSchema
});

export const daemonPairingClaimResponseSchema = z.object({
  apiUrl: daemonPairingApiUrlSchema,
  daemonId: z.string().trim().min(1),
  deviceToken: z.string().trim().min(32),
  tokenExpiresAt: z.string().datetime()
});

export const daemonDeviceTokenPayloadSchema = z.object({
  version: z.literal(1),
  tokenId: z.string().uuid(),
  ownerId: z.string().trim().min(1),
  daemonId: z.string().trim().min(1),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive()
});

export type DaemonPairingStatus = z.infer<typeof daemonPairingStatusSchema>;
export type DaemonPairingCreateRequest = z.infer<typeof daemonPairingCreateRequestSchema>;
export type DaemonPairingCreateResponse = z.infer<typeof daemonPairingCreateResponseSchema>;
export type DaemonPairingStatusResponse = z.infer<typeof daemonPairingStatusResponseSchema>;
export type DaemonPairingClaimRequest = z.infer<typeof daemonPairingClaimRequestSchema>;
export type DaemonPairingClaimResponse = z.infer<typeof daemonPairingClaimResponseSchema>;
export type DaemonPairingDevice = z.infer<typeof daemonPairingDeviceSchema>;
export type DaemonDeviceTokenPayload = z.infer<typeof daemonDeviceTokenPayloadSchema>;
