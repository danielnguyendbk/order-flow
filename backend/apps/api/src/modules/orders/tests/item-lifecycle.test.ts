import { OrderService } from "../order.service";
import { OrderRepository } from "../order.repository";
import { HistoryRepository } from "../../order-status-history/history.repository";
import { PaymentRepository } from "../../payments/payment.repository";
import { FulfillmentStatus, PaymentStatus } from "../order.types";
import { calculateTotal } from "../order-total";

jest.mock("@prisma/client", () => {
  const mPrisma = {
    menuItem: {
      findUnique: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn().mockImplementation(() => mPrisma),
    Prisma: {},
  };
});

import { PrismaClient } from "@prisma/client";

describe("Order item lifecycle", () => {
  let prismaInstance: any;
  let repository: jest.Mocked<OrderRepository>;
  let service: OrderService;

  const editableOrder = {
    id: "order-1",
    paymentStatus: PaymentStatus.UNPAID,
    fulfillmentStatus: FulfillmentStatus.PENDING_PAYMENT,
    items: [
      { id: "order-item-1", orderId: "order-1", menuItemId: "menu-1", itemName: "Coffee", unitPrice: 20000n, quantity: 1 },
      { id: "order-item-2", orderId: "order-1", menuItemId: "menu-2", itemName: "Tea", unitPrice: 15000n, quantity: 1 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaInstance = new PrismaClient();
    repository = {
      findById: jest.fn(),
      findItemById: jest.fn(),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      deleteItem: jest.fn(),
    } as any;
    service = new OrderService(
      repository,
      {} as HistoryRepository,
      {} as PaymentRepository,
    );
  });

  it("snapshots the active menu item name and backend price when adding", async () => {
    repository.findById.mockResolvedValue(editableOrder as any);
    prismaInstance.menuItem.findUnique.mockResolvedValue({
      id: "menu-3",
      name: "Cappuccino",
      price: 45000n,
      isAvailable: true,
      category: { name: "Coffee", isActive: true },
    });
    repository.addItem.mockResolvedValue({ id: "order-1" } as any);

    await service.addItem("order-1", {
      menuItemId: "menu-3",
      quantity: 2,
      note: "Less ice",
    });

    expect(repository.addItem).toHaveBeenCalledWith("order-1", {
      menuItemId: "menu-3",
      itemName: "Cappuccino",
      unitPrice: 45000n,
      quantity: 2,
      note: "Less ice",
    });
  });

  it.each([
    [{ isAvailable: false, category: { name: "Coffee", isActive: true } }, "not currently available"],
    [{ isAvailable: true, category: { name: "Coffee", isActive: false } }, "not currently active"],
  ])("rejects an inactive menu selection", async (state, message) => {
    repository.findById.mockResolvedValue(editableOrder as any);
    prismaInstance.menuItem.findUnique.mockResolvedValue({
      id: "menu-3",
      name: "Cappuccino",
      price: 45000n,
      ...state,
    });

    await expect(
      service.addItem("order-1", { menuItemId: "menu-3", quantity: 1 }),
    ).rejects.toThrow(message);
    expect(repository.addItem).not.toHaveBeenCalled();
  });

  it.each(["add", "update", "delete"] as const)(
    "blocks %s when QR payment is pending",
    async (operation) => {
      repository.findById.mockResolvedValue({
        ...editableOrder,
        paymentStatus: PaymentStatus.PENDING,
      } as any);

      const action = operation === "add"
        ? service.addItem("order-1", { menuItemId: "menu-3", quantity: 1 })
        : operation === "update"
          ? service.updateItem("order-1", "order-item-1", { quantity: 2 })
          : service.deleteItem("order-1", "order-item-1");

      await expect(action).rejects.toMatchObject({ statusCode: 409 });
    },
  );

  it("updates an unpaid item quantity", async () => {
    repository.findById.mockResolvedValue(editableOrder as any);
    repository.findItemById.mockResolvedValue(editableOrder.items[0] as any);
    repository.updateItem.mockResolvedValue({ id: "order-1", totalAmount: 55000n } as any);

    const result = await service.updateItem("order-1", "order-item-1", { quantity: 2 });

    expect(repository.updateItem).toHaveBeenCalledWith("order-1", "order-item-1", { quantity: 2 });
    expect(result.totalAmount).toBe(55000n);
  });

  it("deletes an item from an unpaid order", async () => {
    repository.findById.mockResolvedValue(editableOrder as any);
    repository.findItemById.mockResolvedValue(editableOrder.items[0] as any);
    repository.deleteItem.mockResolvedValue({ id: "order-1", totalAmount: 15000n } as any);

    const result = await service.deleteItem("order-1", "order-item-1");

    expect(repository.deleteItem).toHaveBeenCalledWith("order-1", "order-item-1");
    expect(result.totalAmount).toBe(15000n);
  });

  it("calculates total only from snapshotted unit prices and quantities", () => {
    expect(calculateTotal([
      { unitPrice: 45000n, quantity: 2 },
      { unitPrice: 15000n, quantity: 1 },
    ])).toBe(105000n);
  });
});
