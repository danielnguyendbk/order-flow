import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export const requestId: RequestHandler = (request, response, next) => {
  const incoming = request.header("x-request-id");
  request.requestId =
    incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  response.setHeader("x-request-id", request.requestId);
  next();
};

