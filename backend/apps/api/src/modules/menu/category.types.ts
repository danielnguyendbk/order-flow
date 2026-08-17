export interface MenuCategory {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMenuCategoryInput {
  name: string;
  displayOrder?: number;
  isActive?: boolean;
}

export type UpdateMenuCategoryInput = Partial<CreateMenuCategoryInput>;

