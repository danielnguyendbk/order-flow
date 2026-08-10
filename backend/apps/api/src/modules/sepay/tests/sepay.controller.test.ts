import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { SepayController } from "../sepay.controller";
import { createSepayRouter } from "../sepay.routes";

afterEach(() => vi.unstubAllEnvs());

describe("SePay webhook HTTP contract", () => {
  it("returns the success flag required by SePay", async () => {
    const handleWebhook = vi.fn().mockResolvedValue({
      duplicate: false,
      matched: true,
      transactionId: "transaction-1",
      paymentId: "payment-1",
      matchStatus: "MATCHED",
    });
    const controller = new SepayController({ handleWebhook } as any);
    const req: any = { body: { id: 92704, transferAmount: 30_000 }, headers: {} };
    const json = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json }) };

    await controller.handleWebhook(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true, ok: true, matched: true }));
  });

  it("returns HTTP 401 for a wrong SePay API key", async () => {
    vi.stubEnv("SEPAY_WEBHOOK_API_KEY", "correct-key");
    const app = express();
    app.use(express.json());
    app.use("/webhook", createSepayRouter());
    app.use(errorHandler);

    const response = await request(app)
      .post("/webhook")
      .set("Authorization", "Apikey wrong-key")
      .send({ id: 92704, transferAmount: 30_000, content: "PAYUNKNOWN" });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });
});
