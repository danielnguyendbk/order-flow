import type { FastifyRequest } from "fastify";

import { AppError } from "../../core/errors.js";
import type { AuthServicePort } from "./auth.service.js";
import type { AccessIdentity } from "./auth.types.js";

declare module "fastify" {
  interface FastifyRequest {
    auth: AccessIdentity;
  }
}

function readBearerToken(request: FastifyRequest): string {
  const authorization = request.headers.authorization;
  const [scheme, token, extra] = authorization?.split(" ") ?? [];
  if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
    throw new AppError("UNAUTHORIZED", "Bearer token is required");
  }
  return token;
}

export function requireAdminAuth(authService: AuthServicePort) {
  return async function adminAuthMiddleware(request: FastifyRequest): Promise<void> {
    request.auth = await authService.authenticate(readBearerToken(request), "OWNER");
  };
}

