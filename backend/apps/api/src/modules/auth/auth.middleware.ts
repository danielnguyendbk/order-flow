import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../core/errors.js";
import type { AuthServicePort } from "./auth.service.js";
import type { AccessIdentity, AccessRole } from "./auth.types.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessIdentity;
    }
  }
}

function readBearerToken(request: Request): string {
  const [scheme, token, extra] = request.headers.authorization?.split(" ") ?? [];
  if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
    throw new AppError("UNAUTHORIZED", "Bearer token is required");
  }
  return token;
}

function requireRoles(authService: AuthServicePort, roles: AccessRole[]) {
  return async function adminAuthMiddleware(
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      request.auth = await authService.authenticate(
        readBearerToken(request),
        roles,
      );
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdminAuth(authService: AuthServicePort) {
  return requireRoles(authService, ["OWNER"]);
}

export function requireAdminAccess(authService: AuthServicePort) {
  return requireRoles(authService, ["OWNER", "SERVICE_STAFF"]);
}
