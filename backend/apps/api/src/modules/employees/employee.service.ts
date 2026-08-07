import { AppError } from "../../core/errors.js";
import type { EmployeeRepositoryPort } from "./employee.repository.js";
import type {
  CreateEmployeeInput,
  Employee,
  EmployeeFilters,
  PaginatedEmployees,
  UpdateEmployeeInput,
} from "./employee.types.js";

export interface EmployeeServicePort {
  list(filters: EmployeeFilters): Promise<PaginatedEmployees>;
  get(id: string): Promise<Employee>;
  create(input: CreateEmployeeInput): Promise<Employee>;
  update(id: string, input: UpdateEmployeeInput): Promise<Employee>;
  activate(id: string): Promise<Employee>;
  deactivate(id: string): Promise<Employee>;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export class EmployeeService implements EmployeeServicePort {
  constructor(private readonly repository: EmployeeRepositoryPort) {}

  list(filters: EmployeeFilters): Promise<PaginatedEmployees> {
    return this.repository.findAll(filters);
  }

  async get(id: string): Promise<Employee> {
    return this.requireEmployee(await this.repository.findById(id));
  }

  async create(input: CreateEmployeeInput): Promise<Employee> {
    try {
      return await this.repository.create(input);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Telegram ID or username already exists");
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateEmployeeInput): Promise<Employee> {
    try {
      return this.requireEmployee(await this.repository.update(id, input));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Telegram ID or username already exists");
      }
      throw error;
    }
  }

  async activate(id: string): Promise<Employee> {
    return this.requireEmployee(await this.repository.setStatus(id, "ACTIVE"));
  }

  async deactivate(id: string): Promise<Employee> {
    return this.requireEmployee(await this.repository.setStatus(id, "INACTIVE"));
  }

  private requireEmployee(employee: Employee | null): Employee {
    if (!employee) throw new AppError("NOT_FOUND", "Employee not found");
    return employee;
  }
}

