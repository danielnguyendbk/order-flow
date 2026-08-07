import type { Request, RequestHandler } from "express";
import type { ZodType } from "zod";

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    try {
      request.body = schema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    try {
      Object.defineProperty(request, "query", {
        value: schema.parse(request.query),
        writable: true,
        configurable: true,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateParams<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    try {
      request.params = schema.parse(request.params) as Request["params"];
      next();
    } catch (error) {
      next(error);
    }
  };
}
