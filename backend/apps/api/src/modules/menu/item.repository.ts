import type { Pool } from "pg";

import type {
  CreateMenuItemInput,
  MenuItem,
  MenuItemFilters,
  PaginatedMenuItems,
  UpdateMenuItemInput,
} from "./item.types.js";

interface ItemRow {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: string;
  is_available: boolean;
  image_url: string | null;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `i.id, i.category_id, i.name, i.description, i.price,
  i.is_available, i.image_url, i.display_order, i.created_at, i.updated_at`;
const mapItem = (row: ItemRow): MenuItem => ({
  id: row.id,
  categoryId: row.category_id,
  name: row.name,
  description: row.description,
  price: Number(row.price),
  isAvailable: row.is_available,
  imageUrl: row.image_url,
  displayOrder: row.display_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface ItemRepositoryPort {
  findAll(filters: MenuItemFilters): Promise<PaginatedMenuItems>;
  findById(id: string): Promise<MenuItem | null>;
  create(input: CreateMenuItemInput): Promise<MenuItem>;
  update(id: string, input: UpdateMenuItemInput): Promise<MenuItem | null>;
  delete(id: string): Promise<boolean>;
}

export class ItemRepository implements ItemRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findAll(filters: MenuItemFilters): Promise<PaginatedMenuItems> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const add = (condition: string, value: unknown) => {
      values.push(value);
      conditions.push(condition.replace("?", `$${values.length}`));
    };
    if (filters.categoryId) add("i.category_id = ?", filters.categoryId);
    if (filters.search) {
      const term = `%${filters.search}%`;
      values.push(term, term);
      conditions.push(
        `(i.name ilike $${values.length - 1} or i.description ilike $${values.length})`,
      );
    }
    if (filters.isAvailable !== undefined) add("i.is_available = ?", filters.isAvailable);
    if (filters.publicOnly) conditions.push("c.is_active = true");
    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
    const offset = (filters.page - 1) * filters.limit;
    const [rows, count] = await Promise.all([
      this.pool.query<ItemRow>(
        `select ${COLUMNS} from public.menu_items i
         join public.menu_categories c on c.id = i.category_id
         ${where} order by i.display_order asc, i.name asc
         limit $${values.length + 1} offset $${values.length + 2}`,
        [...values, filters.limit, offset],
      ),
      this.pool.query<{ total: string }>(
        `select count(*)::text as total from public.menu_items i
         join public.menu_categories c on c.id = i.category_id ${where}`,
        values,
      ),
    ]);
    const total = Number(count.rows[0]?.total ?? 0);
    return {
      data: rows.rows.map(mapItem),
      meta: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) },
    };
  }

  async findById(id: string): Promise<MenuItem | null> {
    const result = await this.pool.query<ItemRow>(
      `select ${COLUMNS} from public.menu_items i where i.id = $1 limit 1`,
      [id],
    );
    return result.rows[0] ? mapItem(result.rows[0]) : null;
  }

  async create(input: CreateMenuItemInput): Promise<MenuItem> {
    const result = await this.pool.query<ItemRow>(
      `insert into public.menu_items
        (category_id, name, description, price, is_available, image_url, display_order)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, category_id, name, description, price, is_available,
         image_url, display_order, created_at, updated_at`,
      [input.categoryId, input.name, input.description ?? null, input.price,
        input.isAvailable ?? true, input.imageUrl ?? null, input.displayOrder ?? 0],
    );
    return mapItem(result.rows[0]!);
  }

  async update(id: string, input: UpdateMenuItemInput): Promise<MenuItem | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };
    if (input.categoryId !== undefined) add("category_id", input.categoryId);
    if (input.name !== undefined) add("name", input.name);
    if (input.description !== undefined) add("description", input.description);
    if (input.price !== undefined) add("price", input.price);
    if (input.isAvailable !== undefined) add("is_available", input.isAvailable);
    if (input.imageUrl !== undefined) add("image_url", input.imageUrl);
    if (input.displayOrder !== undefined) add("display_order", input.displayOrder);
    values.push(id);
    const result = await this.pool.query<ItemRow>(
      `update public.menu_items set ${fields.join(", ")}
       where id = $${values.length}
       returning id, category_id, name, description, price, is_available,
         image_url, display_order, created_at, updated_at`,
      values,
    );
    return result.rows[0] ? mapItem(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query("delete from public.menu_items where id = $1", [id]);
    return result.rowCount === 1;
  }
}
