import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

declare module "fastify" {
  interface FastifyRequest {
    actor: ActorContext;
  }
}

export type SeekDeskAuthMode = "development" | "oidc";

export interface ActorContext {
  ownerId: string;
  subject: string;
  authMode: SeekDeskAuthMode;
  claims: Readonly<JWTPayload>;
}

export interface ActorRequestLike {
  headers: Record<string, string | string[] | undefined>;
}

export interface ActorAuthReadiness {
  mode: SeekDeskAuthMode;
  configured: boolean;
  productionCloudRuntimeAllowed: boolean;
  issuerConfigured: boolean;
  audienceConfigured: boolean;
  jwksConfigured: boolean;
}

type TokenVerifier = (token: string) => Promise<JWTPayload>;

export class ActorAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode: 401 | 403 | 503
  ) {
    super(message);
    this.name = "ActorAuthError";
  }
}

export class ActorContextResolver {
  readonly readiness: ActorAuthReadiness;
  private readonly devUserId: string;
  private readonly verifyToken: TokenVerifier | undefined;

  constructor(
    env: NodeJS.ProcessEnv = process.env,
    options: { verifyToken?: TokenVerifier } = {}
  ) {
    const authMode = env.SEEKDESK_AUTH_MODE === "oidc" ? "oidc" : "development";
    const issuer = env.SEEKDESK_OIDC_ISSUER?.trim();
    const audience = env.SEEKDESK_OIDC_AUDIENCE?.trim();
    const jwksUrl = env.SEEKDESK_OIDC_JWKS_URL?.trim();
    const configured = authMode === "development" || Boolean(issuer && audience && jwksUrl);
    this.readiness = {
      mode: authMode,
      configured,
      productionCloudRuntimeAllowed: authMode === "development" || configured,
      issuerConfigured: Boolean(issuer),
      audienceConfigured: Boolean(audience),
      jwksConfigured: Boolean(jwksUrl)
    };
    this.devUserId = env.SEEKDESK_DEV_USER_ID?.trim() || "local-dev-user";
    this.verifyToken = options.verifyToken ?? (
      configured && authMode === "oidc" && issuer && audience && jwksUrl
        ? createOidcVerifier({ issuer, audience, jwksUrl })
        : undefined
    );
  }

  async resolve(request: ActorRequestLike): Promise<ActorContext> {
    if (this.readiness.mode === "development") {
      return {
        ownerId: this.devUserId,
        subject: this.devUserId,
        authMode: "development",
        claims: { sub: this.devUserId }
      };
    }
    if (!this.readiness.configured || !this.verifyToken) {
      throw new ActorAuthError(
        "Production OIDC authentication is not configured.",
        "auth_not_configured",
        503
      );
    }
    const token = extractBearerToken(request.headers.authorization);
    const claims = await this.verifyToken(token).catch(() => {
      throw new ActorAuthError("Bearer token is invalid.", "invalid_access_token", 401);
    });
    const subject = claims.sub?.trim();
    if (!subject) {
      throw new ActorAuthError("Token subject is required.", "token_subject_missing", 401);
    }
    return { ownerId: subject, subject, authMode: "oidc", claims };
  }
}

export function createActorContextResolver(env: NodeJS.ProcessEnv = process.env) {
  return new ActorContextResolver(env);
}

function createOidcVerifier(input: { issuer: string; audience: string; jwksUrl: string }): TokenVerifier {
  const jwks = createRemoteJWKSet(new URL(input.jwksUrl));
  return async (token) => {
    const result = await jwtVerify(token, jwks, {
      issuer: input.issuer,
      audience: input.audience,
      algorithms: ["RS256", "ES256"]
    });
    return result.payload;
  };
}

function extractBearerToken(value: string | string[] | undefined) {
  const header = Array.isArray(value) ? value[0] : value;
  const match = /^Bearer\s+(.+)$/i.exec(header?.trim() ?? "");
  if (!match?.[1]) {
    throw new ActorAuthError("Bearer token is required.", "access_token_required", 401);
  }
  return match[1];
}
