import { AppError } from "../../core/errors.js";
import type { ItemRepositoryPort } from "./item.repository.js";
import type {
  CreateMenuItemInput,
  MenuItem,
  MenuItemFilters,
  PaginatedMenuItems,
  UpdateMenuItemInput,
} from "./item.types.js";

export interface ItemServicePort {
  list(filters: MenuItemFilters): Promise<PaginatedMenuItems>;
  get(id: string): Promise<MenuItem>;
  create(input: CreateMenuItemInput): Promise<MenuItem>;
  update(id: string, input: UpdateMenuItemInput): Promise<MenuItem>;
  delete(id: string): Promise<void>;
}

function databaseCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

export class ItemService implements ItemServicePort {
  constructor(private readonly repository: ItemRepositoryPort) {}

  list(filters: MenuItemFilters): Promise<PaginatedMenuItems> {
    return this.repository.findAll(filters);
  }

  async get(id: string): Promise<MenuItem> {
    const item = await this.repository.findById(id);
    if (!item) throw new AppError("NOT_FOUND", "Menu item not found");
    return item;
  }

  async create(input: CreateMenuItemInput): Promise<MenuItem> {
    try {
      return await this.repository.create(input);
    } catch (error) {
      if (databaseCode(error) === "23503") {
        throw new AppError("NOT_FOUND", "Menu category not found");
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateMenuItemInput): Promise<MenuItem> {
    try {
      const item = await this.repository.update(id, input);
      if (!item) throw new AppError("NOT_FOUND", "Menu item not found");
      return item;
    } catch (error) {
      if (databaseCode(error) === "23503") {
        throw new AppError("NOT_FOUND", "Menu category not found");
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      if (!(await this.repository.delete(id))) {
        throw new AppError("NOT_FOUND", "Menu item not found");
      }
    } catch (error) {
      if (databaseCode(error) === "23503") {
        throw new AppError("CONFLICT", "Menu item is still referenced by orders");
      }
      throw error;
    }
  }
}

