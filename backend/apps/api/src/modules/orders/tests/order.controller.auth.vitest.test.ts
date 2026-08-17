import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderController } from "../order.controller";
import type { OrderService } from "../order.service";

describe("OrderController authenticated actor", () => {
  const order = { id: "order-1" };
  let service: {
    markReady: ReturnType<typeof vi.fn>;
    deliverOrder: ReturnType<typeof vi.fn>;
  };
  let response: Response;
  let next: NextFunction;

  beforeEach(() => {
    service = {
      markReady: vi.fn().mockResolvedValue(order),
      deliverOrder: vi.fn().mockResolvedValue(order),
    };
    response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    next = vi.fn();
  });

  function requestWithSpoofedActor(): Request {
    return {
      params: { orderId: "order-1" },
      body: { requesterId: "spoofed-user", baristaId: "spoofed-barista" },
      auth: { userId: "owner-1", sessionId: "session-1", role: "OWNER" },
    } as unknown as Request;
  }

  it("uses the authenticated user when marking an order ready", async () => {
    const controller = new OrderController(service as unknown as OrderService);

    await controller.markReady(requestWithSpoofedActor(), response, next);

    expect(service.markReady).toHaveBeenCalledWith("order-1", "owner-1");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it("uses the authenticated user when delivering an order", async () => {
    const controller = new OrderController(service as unknown as OrderService);

    await controller.deliverOrder(requestWithSpoofedActor(), response, next);

    expect(service.deliverOrder).toHaveBeenCalledWith("order-1", "owner-1");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
