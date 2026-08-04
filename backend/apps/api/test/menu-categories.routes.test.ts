import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import type { AuthServicePort } from "../src/modules/auth/auth.service.js";
import type { AccessIdentity, AuthSessionResult, PublicAuthUser } from "../src/modules/auth/auth.types.js";
import type { CategoryServicePort } from "../src/modules/menu/category.service.js";
import type { CreateMenuCategoryInput, MenuCategory, UpdateMenuCategoryInput } from "../src/modules/menu/category.types.js";

const categoryId = "29fb80af-25dc-4a21-aab8-f17fb93578ab";
const category: MenuCategory = {
  id: categoryId,
  name: "Coffee",
  displayOrder: 1,
  isActive: true,
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

class CategoryStub implements CategoryServicePort {
  async listPublic(): Promise<MenuCategory[]> { return [category]; }
  async listAdmin(): Promise<MenuCategory[]> { return [category]; }
  async create(input: CreateMenuCategoryInput): Promise<MenuCategory> { return { ...category, ...input }; }
  async update(_id: string, input: UpdateMenuCategoryInput): Promise<MenuCategory> { return { ...category, ...input }; }
  async delete(): Promise<void> {}
}

function app() {
  return createApp({
    authService: new AuthStub(),
    categoryService: new CategoryStub(),
    mountOperationalRoutes: false,
  });
}

test("menu category routes expose public and admin operations", async () => {
  const auth = { authorization: "Bearer access-token" };
  const publicList = await request(app()).get("/api/v1/menu/categories");
  assert.equal(publicList.status, 200);
  assert.equal(publicList.body.data[0].name, "Coffee");
  assert.equal((await request(app()).get("/api/v1/admin/menu-categories").set(auth)).status, 200);
  assert.equal((await request(app()).post("/api/v1/admin/menu-categories").set(auth).send({ name: "Tea" })).status, 201);
  assert.equal((await request(app()).patch(`/api/v1/admin/menu-categories/${categoryId}`).set(auth).send({ isActive: false })).status, 200);
  assert.equal((await request(app()).delete(`/api/v1/admin/menu-categories/${categoryId}`).set(auth)).status, 204);
});

test("menu category admin routes require authentication and validate bodies", async () => {
  assert.equal((await request(app()).get("/api/v1/admin/menu-categories")).status, 401);
  const invalid = await request(app())
    .post("/api/v1/admin/menu-categories")
    .set("authorization", "Bearer access-token")
    .send({ name: "", displayOrder: -1 });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "VALIDATION_ERROR");
});
