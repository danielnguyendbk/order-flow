import type { Pool } from "pg";

import type {
  CreateMenuCategoryInput,
  MenuCategory,
  UpdateMenuCategoryInput,
} from "./category.types.js";

interface CategoryRow {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = "id, name, display_order, is_active, created_at, updated_at";
const mapCategory = (row: CategoryRow): MenuCategory => ({
  id: row.id,
  name: row.name,
  displayOrder: row.display_order,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface CategoryRepositoryPort {
  findAll(filters?: { search?: string; isActive?: boolean }): Promise<MenuCategory[]>;
  create(input: CreateMenuCategoryInput): Promise<MenuCategory>;
  update(id: string, input: UpdateMenuCategoryInput): Promise<MenuCategory | null>;
  delete(id: string): Promise<boolean>;
}

export class CategoryRepository implements CategoryRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findAll(filters: { search?: string; isActive?: boolean } = {}): Promise<MenuCategory[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filters.search) {
      values.push(`%${filters.search}%`);
      conditions.push(`name ilike $${values.length}`);
    }
    if (filters.isActive !== undefined) {
      values.push(filters.isActive);
      conditions.push(`is_active = $${values.length}`);
    }
    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
    const result = await this.pool.query<CategoryRow>(
      `select ${COLUMNS} from public.menu_categories ${where}
       order by display_order asc, name asc`,
      values,
    );
    return result.rows.map(mapCategory);
  }

  async create(input: CreateMenuCategoryInput): Promise<MenuCategory> {
    const result = await this.pool.query<CategoryRow>(
      `insert into public.menu_categories (name, display_order, is_active)
       values ($1, $2, $3) returning ${COLUMNS}`,
      [input.name, input.displayOrder ?? 0, input.isActive ?? true],
    );
    return mapCategory(result.rows[0]!);
  }

  async update(id: string, input: UpdateMenuCategoryInput): Promise<MenuCategory | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };
    if (input.name !== undefined) add("name", input.name);
    if (input.displayOrder !== undefined) add("display_order", input.displayOrder);
    if (input.isActive !== undefined) add("is_active", input.isActive);
    values.push(id);
    const result = await this.pool.query<CategoryRow>(
      `update public.menu_categories set ${fields.join(", ")}
       where id = $${values.length} returning ${COLUMNS}`,
      values,
    );
    return result.rows[0] ? mapCategory(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      "delete from public.menu_categories where id = $1",
      [id],
    );
    return result.rowCount === 1;
  }
}

