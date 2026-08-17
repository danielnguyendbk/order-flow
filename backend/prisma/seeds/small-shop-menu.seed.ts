import type { PrismaClient } from "@prisma/client";

const MENU = [
  {
    name: "Cà phê",
    displayOrder: 10,
    items: [
      {
        name: "Cà phê đen đá",
        description: "Cà phê Robusta pha phin đậm vị, dùng cùng đá.",
        price: 25_000,
      },
      {
        name: "Cà phê sữa đá",
        description: "Cà phê phin kết hợp sữa đặc, vị đậm và cân bằng.",
        price: 29_000,
      },
      {
        name: "Bạc xỉu",
        description: "Sữa thơm béo với một phần cà phê nhẹ.",
        price: 32_000,
      },
    ],
  },
  {
    name: "Trà trái cây",
    displayOrder: 20,
    items: [
      {
        name: "Trà đào cam sả",
        description: "Trà đào thanh mát cùng cam tươi và sả.",
        price: 35_000,
      },
      {
        name: "Trà tắc mật ong",
        description: "Trà tắc chua nhẹ, cân bằng bằng mật ong.",
        price: 30_000,
      },
    ],
  },
  {
    name: "Sữa & Matcha",
    displayOrder: 30,
    items: [
      {
        name: "Matcha latte",
        description: "Matcha thơm dịu hòa cùng sữa tươi.",
        price: 39_000,
      },
      {
        name: "Cacao sữa đá",
        description: "Cacao nguyên chất pha sữa, vị đắng nhẹ.",
        price: 34_000,
      },
    ],
  },
] as const;

export async function seedSmallShopMenu(prisma: PrismaClient): Promise<void> {
  const result = await prisma.$transaction(async (tx) => {
    const disabledFixtures = await tx.menuCategory.updateMany({
      where: {
        OR: [
          { name: { startsWith: "THAI" } },
          { name: { startsWith: "BE004" } },
        ],
      },
      data: { isActive: false },
    });

    let itemCount = 0;
    for (const categorySpec of MENU) {
      const category = await tx.menuCategory.upsert({
        where: { name: categorySpec.name },
        create: {
          name: categorySpec.name,
          displayOrder: categorySpec.displayOrder,
          isActive: true,
        },
        update: {
          displayOrder: categorySpec.displayOrder,
          isActive: true,
        },
      });

      for (const [index, itemSpec] of categorySpec.items.entries()) {
        const existing = await tx.menuItem.findFirst({
          where: { categoryId: category.id, name: itemSpec.name },
          select: { id: true },
        });
        const data = {
          categoryId: category.id,
          name: itemSpec.name,
          description: itemSpec.description,
          price: BigInt(itemSpec.price),
          isAvailable: true,
          displayOrder: index + 1,
        };

        if (existing) await tx.menuItem.update({ where: { id: existing.id }, data });
        else await tx.menuItem.create({ data });
        itemCount += 1;
      }
    }

    return {
      categoryCount: MENU.length,
      itemCount,
      disabledFixtureCategoryCount: disabledFixtures.count,
    };
  });

  console.info(result, "Small F&B shop menu seed completed");
}
