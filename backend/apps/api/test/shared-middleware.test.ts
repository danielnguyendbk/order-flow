import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import request from "supertest";
import { z } from "zod";

import { AppError } from "../src/core/errors.js";
import {
  asyncHandler,
  errorHandler,
  notFound,
  requestId,
  validateBody,
} from "../src/middleware/index.js";

function testApp() {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.post(
    "/validated",
    validateBody(z.object({ name: z.string().min(2) })),
    (req, res) => res.json({ data: req.body }),
  );
  app.get(
    "/async-error",
    asyncHandler(async () => {
      throw new AppError("FORBIDDEN", "Denied");
    }),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

test("request ID is preserved when valid and generated otherwise", async () => {
  const preserved = await request(testApp())
    .post("/validated")
    .set("x-request-id", "request-123")
    .send({ name: "OK" });
  assert.equal(preserved.headers["x-request-id"], "request-123");

  const generated = await request(testApp())
    .post("/validated")
    .send({ name: "OK" });
  assert.match(generated.headers["x-request-id"], /^[0-9a-f-]{36}$/);
});

test("validation and async errors use the shared response contract", async () => {
  const invalid = await request(testApp()).post("/validated").send({ name: "x" });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "VALIDATION_ERROR");
  assert.ok(invalid.body.error.requestId);

  const forbidden = await request(testApp()).get("/async-error");
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.error.code, "FORBIDDEN");
});

test("unknown routes use the shared not-found middleware", async () => {
  const response = await request(testApp()).get("/missing");
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "NOT_FOUND");
  assert.ok(response.body.error.requestId);
});
