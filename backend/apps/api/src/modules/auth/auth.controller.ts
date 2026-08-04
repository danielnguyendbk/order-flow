import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuthServicePort } from "./auth.service.js";
import {
  adminLoginSchema,
  refreshSchema,
  telegramSessionSchema,
} from "./auth.schemas.js";

function metadata(request: FastifyRequest) {
  return {
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"],
  };
}

export class AuthController {
  constructor(private readonly authService: AuthServicePort) {}

  telegramSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const input = telegramSessionSchema.parse(request.body);
    const session = await this.authService.createTelegramSession(
      input.initData,
      metadata(request),
    );
    return reply.code(201).send({ data: session });
  };

  adminLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    const input = adminLoginSchema.parse(request.body);
    const session = await this.authService.loginAdmin(
      input.username,
      input.password,
      metadata(request),
    );
    return reply.code(200).send({ data: session });
  };

  refresh = async (request: FastifyRequest, reply: FastifyReply) => {
    const input = refreshSchema.parse(request.body);
    const session = await this.authService.refresh(input.refreshToken);
    return reply.code(200).send({ data: session });
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    await this.authService.logout(request.auth);
    return reply.code(204).send();
  };

  me = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await this.authService.me(request.auth);
    return reply.code(200).send({ data: user });
  };
}

