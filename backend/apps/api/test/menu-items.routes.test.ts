import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import type { AuthServicePort } from "../src/modules/auth/auth.service.js";
import type { AccessIdentity, AuthSessionResult, PublicAuthUser } from "../src/modules/auth/auth.types.js";
import type { ItemServicePort } from "../src/modules/menu/item.service.js";
import type { CreateMenuItemInput, MenuItem, MenuItemFilters, PaginatedMenuItems, UpdateMenuItemInput } from "../src/modules/menu/item.types.js";

const itemId = "29fb80af-25dc-4a21-aab8-f17fb93578ab";
const categoryId = "a8436ed3-9870-4cf6-bfb6-0fd907b91c87";
const item: MenuItem = {
  id: itemId,
  categoryId,
  name: "Cappuccino",
  description: null,
  price: 45000,
  isAvailable: true,
  imageUrl: null,
  displayOrder: 1,
  createdAt: new Date("2026-08-04T00:00:00.000Z"),
  updatedAt: new Date("2026-08-04T00:00:00.000Z"),
};

class AuthStub implements AuthServicePort {
  async authenticate(): Promise<AccessIdentity> { return { userId: "owner", sessionId: "session", role: "OWNER" }; }
  async loginAdmin(): Promise<AuthSessionResult> { throw new Error("unused"); }
  async createTelegramSession(): Promise<AuthSessionResult> { throw new Error("unused"); }
  async refresh(): Promise<AuthSessionResult> { throw new Error("unused"); }
  async me(): Promise<PublicAuthUser> { throw new Error("unused"); }
  async logout(): Promise<void> {}
}

class ItemStub implements ItemServicePort {
  async list(_filters: MenuItemFilters): Promise<PaginatedMenuItems> {
    return { data: [item], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } };
  }
  async get(): Promise<MenuItem> { return item; }
  async create(input: CreateMenuItemInput): Promise<MenuItem> { return { ...item, ...input }; }
  async update(_id: string, input: UpdateMenuItemInput): Promise<MenuItem> { return { ...item, ...input }; }
  async delete(): Promise<void> {}
}

function app() {
  return createApp({
    authService: new AuthStub(),
    itemService: new ItemStub(),
    mountOperationalRoutes: false,
  });
}

test("menu item routes expose public and admin operations", async () => {
  const auth = { authorization: "Bearer access-token" };
  assert.equal((await request(app()).get("/api/v1/menu/items")).status, 200);
  assert.equal((await request(app()).get("/api/v1/admin/menu-items").set(auth)).status, 200);
  assert.equal((await request(app()).get(`/api/v1/admin/menu-items/${itemId}`).set(auth)).status, 200);
  assert.equal((await request(app()).post("/api/v1/admin/menu-items").set(auth).send({
    categoryId, name: "Cappuccino", price: 45000,
  })).status, 201);
  assert.equal((await request(app()).patch(`/api/v1/admin/menu-items/${itemId}`).set(auth).send({ isAvailable: false })).status, 200);
  assert.equal((await request(app()).delete(`/api/v1/admin/menu-items/${itemId}`).set(auth)).status, 204);
});

test("menu item routes require admin auth and validate price", async () => {
  assert.equal((await request(app()).get("/api/v1/admin/menu-items")).status, 401);
  const invalid = await request(app())
    .post("/api/v1/admin/menu-items")
    .set("authorization", "Bearer access-token")
    .send({ categoryId, name: "Invalid", price: -1 });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "VALIDATION_ERROR");
});
