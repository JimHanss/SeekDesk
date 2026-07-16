import {
  daemonPairingClaimRequestSchema,
  daemonPairingClaimResponseSchema,
  daemonPairingCreateRequestSchema,
  daemonPairingCreateResponseSchema,
  daemonPairingStatusResponseSchema
} from "@seekdesk/shared";
import type { FastifyInstance, FastifyReply } from "fastify";

import {
  DaemonPairingError,
  type DaemonPairingService
} from "../services/daemon-pairing-service.js";

export async function registerDaemonPairingRoutes(
  app: FastifyInstance,
  service: DaemonPairingService
) {
  app.options("/api/coding/daemon-pairings", async (_request, reply) => reply.code(204).send());
  app.options("/api/coding/daemon-pairings/:pairingId", async (_request, reply) => reply.code(204).send());
  app.options("/api/coding/daemon-pairings/claim", async (_request, reply) => reply.code(204).send());

  app.post<{ Body: unknown }>("/api/coding/daemon-pairings", async (request, reply) => {
    const parsed = daemonPairingCreateRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_daemon_pairing_request",
        message: parsed.error.issues[0]?.message ?? "Invalid daemon pairing request."
      });
    }
    return sendPairingReply(reply, () =>
      reply.code(201).send(daemonPairingCreateResponseSchema.parse(service.create({
        ownerId: request.actor.ownerId,
        apiUrl: parsed.data.apiUrl
      })))
    );
  });

  app.get<{ Params: { pairingId: string } }>(
    "/api/coding/daemon-pairings/:pairingId",
    async (request, reply) => sendPairingReply(reply, () =>
      daemonPairingStatusResponseSchema.parse(
        service.getStatus(request.actor.ownerId, request.params.pairingId)
      )
    )
  );

  app.post<{ Body: unknown }>("/api/coding/daemon-pairings/claim", async (request, reply) => {
    const parsed = daemonPairingClaimRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_daemon_pairing_claim",
        message: parsed.error.issues[0]?.message ?? "Invalid daemon pairing claim."
      });
    }
    return sendPairingReply(reply, () =>
      daemonPairingClaimResponseSchema.parse(service.claim(parsed.data))
    );
  });
}

function sendPairingReply(reply: FastifyReply, action: () => unknown) {
  try {
    return action();
  } catch (error) {
    if (error instanceof DaemonPairingError) {
      return reply.code(error.statusCode).send({
        error: error.code,
        message: error.message
      });
    }
    throw error;
  }
}
