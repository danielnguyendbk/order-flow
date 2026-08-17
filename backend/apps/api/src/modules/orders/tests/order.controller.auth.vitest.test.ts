import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderController } from "../order.controller";
import type { OrderService } from "../order.service";

describe("OrderController authenticated actor", () => {
  const order = { id: "order-1" };
  let service: {
    createOrder: ReturnType<typeof vi.fn>;
    addItem: ReturnType<typeof vi.fn>;
    updateItem: ReturnType<typeof vi.fn>;
    deleteItem: ReturnType<typeof vi.fn>;
    cancelOrder: ReturnType<typeof vi.fn>;
    markReady: ReturnType<typeof vi.fn>;
    deliverOrder: ReturnType<typeof vi.fn>;
  };
  let response: Response;
  let next: NextFunction;

  beforeEach(() => {
    service = {
      createOrder: vi.fn().mockResolvedValue(order),
      addItem: vi.fn().mockResolvedValue(order),
      updateItem: vi.fn().mockResolvedValue(order),
      deleteItem: vi.fn().mockResolvedValue(order),
      cancelOrder: vi.fn().mockResolvedValue(order),
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

  it("ignores client supplied actor IDs when creating or editing an order", async () => {
    const controller = new OrderController(service as unknown as OrderService);
    const request = requestWithSpoofedActor();
    request.body = {
      createdByUserId: "spoofed-user",
      requesterId: "spoofed-user",
      items: [{ menuItemId: "item-1", quantity: 1 }],
      menuItemId: "item-1",
      quantity: 1,
      reason: "Customer changed their mind",
    };

    await controller.createOrder(request, response, next);
    await controller.addItem(request, response, next);
    await controller.updateItem(request, response, next);
    await controller.deleteItem(request, response, next);
    await controller.cancelOrder(request, response, next);

    expect(service.createOrder).toHaveBeenCalledWith(expect.objectContaining({ createdByUserId: "owner-1" }));
    expect(service.addItem).toHaveBeenCalledWith("order-1", expect.anything(), "owner-1");
    expect(service.updateItem).toHaveBeenCalledWith("order-1", "undefined", expect.anything(), "owner-1");
    expect(service.deleteItem).toHaveBeenCalledWith("order-1", "undefined", "owner-1");
    expect(service.cancelOrder).toHaveBeenCalledWith("order-1", "Customer changed their mind", "owner-1");
  });

  it("uses the authenticated user when delivering an order", async () => {
    const controller = new OrderController(service as unknown as OrderService);

    await controller.deliverOrder(requestWithSpoofedActor(), response, next);

    expect(service.deliverOrder).toHaveBeenCalledWith("order-1", "owner-1");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
