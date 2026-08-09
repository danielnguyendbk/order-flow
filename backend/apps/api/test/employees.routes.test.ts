import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import type { AuthServicePort } from "../src/modules/auth/auth.service.js";
import type { AccessIdentity, AuthSessionResult, PublicAuthUser } from "../src/modules/auth/auth.types.js";
import type { EmployeeServicePort } from "../src/modules/employees/employee.service.js";
import type { CreateEmployeeInput, Employee, EmployeeFilters, PaginatedEmployees, UpdateEmployeeInput } from "../src/modules/employees/employee.types.js";

const employeeId = "29fb80af-25dc-4a21-aab8-f17fb93578ab";
const employee: Employee = {
  id: employeeId,
  fullName: "Barista One",
  telegramUserId: "123456789",
  telegramChatId: null,
  username: "barista_one",
  role: "BARISTA",
  status: "ACTIVE",
  createdAt: new Date("2026-08-04T00:00:00.000Z"),
  updatedAt: new Date("2026-08-04T00:00:00.000Z"),
};

class AdminAuthStub implements AuthServicePort {
  async authenticate(): Promise<AccessIdentity> { return { userId: "owner", sessionId: "session", role: "OWNER" }; }
  async loginAdmin(): Promise<AuthSessionResult> { throw new Error("unused"); }
  async createTelegramSession(): Promise<AuthSessionResult> { throw new Error("unused"); }
  async refresh(): Promise<AuthSessionResult> { throw new Error("unused"); }
  async me(): Promise<PublicAuthUser> { throw new Error("unused"); }
  async logout(): Promise<void> {}
}

class EmployeeServiceStub implements EmployeeServicePort {
  async list(_filters: EmployeeFilters): Promise<PaginatedEmployees> {
    return { data: [employee], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } };
  }
  async get(): Promise<Employee> { return employee; }
  async create(input: CreateEmployeeInput): Promise<Employee> { return { ...employee, ...input }; }
  async update(_id: string, input: UpdateEmployeeInput): Promise<Employee> { return { ...employee, ...input }; }
  async activate(): Promise<Employee> { return { ...employee, status: "ACTIVE" }; }
  async deactivate(): Promise<Employee> { return { ...employee, status: "INACTIVE" }; }
}

function app() {
  return createApp({
    authService: new AdminAuthStub(),
    employeeService: new EmployeeServiceStub(),
    mountOperationalRoutes: false,
  });
}

test("employee routes expose list, detail, create, update, activate and deactivate", async () => {
  const authorization = { authorization: "Bearer access-token" };
  assert.equal((await request(app()).get("/api/v1/admin/employees").set(authorization)).status, 200);
  assert.equal((await request(app()).get(`/api/v1/admin/employees/${employeeId}`).set(authorization)).status, 200);
  assert.equal((await request(app()).post("/api/v1/admin/employees").set(authorization).send({
    fullName: "Barista One", telegramUserId: "123456789", role: "BARISTA",
  })).status, 201);
  assert.equal((await request(app()).patch(`/api/v1/admin/employees/${employeeId}`).set(authorization).send({ fullName: "Updated" })).status, 200);
  assert.equal((await request(app()).post(`/api/v1/admin/employees/${employeeId}/activate`).set(authorization)).status, 200);
  const deactivated = await request(app()).post(`/api/v1/admin/employees/${employeeId}/deactivate`).set(authorization);
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.body.data.status, "INACTIVE");
});

test("employee routes validate input", async () => {
  const response = await request(app())
    .post("/api/v1/admin/employees")
    .set("authorization", "Bearer access-token")
    .send({ fullName: "", telegramUserId: "invalid", role: "OWNER" });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
});
