export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean;
  imageUrl: string | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuItemFilters {
  page: number;
  limit: number;
  categoryId?: string;
  search?: string;
  isAvailable?: boolean;
  publicOnly?: boolean;
}

export interface CreateMenuItemInput {
  categoryId: string;
  name: string;
  description?: string | null;
  price: number;
  isAvailable?: boolean;
  imageUrl?: string | null;
  displayOrder?: number;
}

export type UpdateMenuItemInput = Partial<CreateMenuItemInput>;

export interface PaginatedMenuItems {
  data: MenuItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

