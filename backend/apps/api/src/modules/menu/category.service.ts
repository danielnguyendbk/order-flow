import { AppError } from "../../core/errors.js";
import type { CategoryRepositoryPort } from "./category.repository.js";
import type { CreateMenuCategoryInput, MenuCategory, UpdateMenuCategoryInput } from "./category.types.js";

export interface CategoryServicePort {
  listPublic(): Promise<MenuCategory[]>;
  listAdmin(filters: { search?: string; isActive?: boolean }): Promise<MenuCategory[]>;
  create(input: CreateMenuCategoryInput): Promise<MenuCategory>;
  update(id: string, input: UpdateMenuCategoryInput): Promise<MenuCategory>;
  delete(id: string): Promise<void>;
}

function databaseCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

export class CategoryService implements CategoryServicePort {
  constructor(private readonly repository: CategoryRepositoryPort) {}

  listPublic(): Promise<MenuCategory[]> {
    return this.repository.findAll({ isActive: true });
  }

  listAdmin(filters: { search?: string; isActive?: boolean }): Promise<MenuCategory[]> {
    return this.repository.findAll(filters);
  }

  async create(input: CreateMenuCategoryInput): Promise<MenuCategory> {
    try {
      return await this.repository.create(input);
    } catch (error) {
      if (databaseCode(error) === "23505") {
        throw new AppError("CONFLICT", "Menu category name already exists");
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateMenuCategoryInput): Promise<MenuCategory> {
    try {
      const category = await this.repository.update(id, input);
      if (!category) throw new AppError("NOT_FOUND", "Menu category not found");
      return category;
    } catch (error) {
      if (databaseCode(error) === "23505") {
        throw new AppError("CONFLICT", "Menu category name already exists");
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      if (!(await this.repository.delete(id))) {
        throw new AppError("NOT_FOUND", "Menu category not found");
      }
    } catch (error) {
      if (databaseCode(error) === "23503") {
        throw new AppError("CONFLICT", "Menu category is still used by menu items");
      }
      throw error;
    }
  }
}
