import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";

import {
  FulfillmentStatus,
  NotificationEvent,
  NotificationStatus,
  OrderStatusDomain,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { config as loadDotenv } from "dotenv";

const ORDER_PREFIX = "VIZSEED-";
const NOTIFICATION_SOURCE_PREFIX = "visualization-seed:";
const MENU_PREFIX = "[VIZ-SEED]";
const DEFAULT_DAYS = 180;
const DEFAULT_ORDERS_PER_DAY = 30;
const DEFAULT_RANDOM_SEED = 20_260_810;
const DEFAULT_DOCKER_DATABASE_URL =
  "postgresql://order_flow:order_flow@localhost:5432/order_flow";
const BATCH_SIZE = 1_000;
const BARISTA_ASSIGNED_STATUSES: readonly FulfillmentStatus[] = [
  FulfillmentStatus.PREPARING,
  FulfillmentStatus.READY,
  FulfillmentStatus.DELIVERED,
];
const READY_OR_LATER_STATUSES: readonly FulfillmentStatus[] = [
  FulfillmentStatus.READY,
  FulfillmentStatus.DELIVERED,
];

interface SeedUser {
  id: string;
  fullName: string;
  role: UserRole;
  telegramChatId: bigint | null;
}

interface MenuSeedItem {
  id: string;
  name: string;
  price: bigint;
}

interface Timeline {
  paidAt: Date | null;
  preparingAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
}

const MENU = [
  {
    name: `${MENU_PREFIX} Cà phê`,
    items: [
      ["Cà phê đen đá", 29_000],
      ["Cà phê sữa đá", 35_000],
      ["Bạc xỉu", 39_000],
      ["Americano", 39_000],
      ["Cappuccino", 49_000],
      ["Latte caramel", 55_000],
    ],
  },
  {
    name: `${MENU_PREFIX} Trà & trà sữa`,
    items: [
      ["Trà đào cam sả", 49_000],
      ["Trà vải", 45_000],
      ["Trà chanh mật ong", 42_000],
      ["Trà sữa trân châu", 49_000],
      ["Trà sữa ô long", 55_000],
      ["Trà sữa matcha", 59_000],
    ],
  },
  {
    name: `${MENU_PREFIX} Đá xay`,
    items: [
      ["Chocolate đá xay", 59_000],
      ["Matcha đá xay", 62_000],
      ["Cookie đá xay", 65_000],
      ["Caramel coffee đá xay", 65_000],
    ],
  },
  {
    name: `${MENU_PREFIX} Nước trái cây`,
    items: [
      ["Nước cam", 49_000],
      ["Nước ép dưa hấu", 45_000],
      ["Nước ép ổi", 45_000],
      ["Chanh tuyết", 49_000],
    ],
  },
  {
    name: `${MENU_PREFIX} Bánh & đồ ăn nhẹ`,
    items: [
      ["Bánh croissant bơ", 35_000],
      ["Bánh tiramisu", 49_000],
      ["Bánh mousse chanh dây", 49_000],
      ["Bánh mì que", 25_000],
      ["Khoai tây chiên", 39_000],
    ],
  },
] as const;

const CUSTOMER_NOTES = [
  null,
  null,
  null,
  "Ít đá",
  "Ít ngọt",
  "Không đường",
  "Mang đi",
  "Giao tại bàn",
  "Tách riêng đồ nóng và đồ lạnh",
];

const ITEM_NOTES = [null, null, null, null, "Ít đá", "50% đường", "Không topping"];
const CANCELLATION_REASONS = [
  "Khách đổi ý",
  "Khách đặt nhầm món",
  "Không liên hệ được khách",
  "Món tạm hết",
];

function findUp(filename: string, startDirectory: string): string | undefined {
  let directory = resolve(startDirectory);
  const root = parse(directory).root;

  while (true) {
    const candidate = join(directory, filename);
    if (existsSync(candidate)) return candidate;
    if (directory === root) return undefined;
    directory = dirname(directory);
  }
}

const envPath =
  process.env.ENV_FILE ??
  findUp(".env.local", process.cwd()) ??
  findUp(".env", process.cwd());
if (envPath) loadDotenv({ path: envPath, quiet: true });

function parseIntegerEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function configureLocalDockerDatabase(): string {
  if (process.env.NODE_ENV?.toLowerCase() === "production") {
    throw new Error("Visualization seed is disabled when NODE_ENV=production");
  }

  // Deliberately ignore DATABASE_URL/DIRECT_URL from .env.local because those
  // values may point at Supabase. This seed has a dedicated local-only target.
  const rawUrl =
    process.env.SEED_VISUALIZATION_DATABASE_URL?.trim() || DEFAULT_DOCKER_DATABASE_URL;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("SEED_VISUALIZATION_DATABASE_URL is not a valid PostgreSQL URL");
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error("Visualization seed only supports PostgreSQL");
  }

  const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0] ?? "");
  if (!allowedHosts.has(url.hostname) || databaseName !== "order_flow") {
    throw new Error(
      "Refusing to seed a remote database. SEED_VISUALIZATION_DATABASE_URL must target the Docker database order_flow through localhost, 127.0.0.1, or ::1.",
    );
  }

  process.env.DATABASE_URL = rawUrl;
  process.env.DIRECT_URL = rawUrl;
  return `${url.hostname}:${url.port || "5432"}/${databaseName}`;
}

function deterministicUuid(key: string): string {
  const bytes = createHash("sha256").update(`order-flow:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };

  return {
    next,
    int(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    chance(probability: number): boolean {
      return next() < probability;
    },
    pick<T>(values: readonly T[]): T {
      return values[Math.floor(next() * values.length)]!;
    },
    weighted<T>(values: ReadonlyArray<readonly [T, number]>): T {
      const total = values.reduce((sum, [, weight]) => sum + weight, 0);
      let cursor = next() * total;
      for (const [value, weight] of values) {
        cursor -= weight;
        if (cursor < 0) return value;
      }
      return values[values.length - 1]![0];
    },
  };
}

type Random = ReturnType<typeof createRandom>;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function timestampForDay(day: Date, isToday: boolean, random: Random): Date {
  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const endMinute = isToday ? Math.max(0, Math.min(currentMinute - 60, 22 * 60)) : 22 * 60;
  const startMinute = Math.min(7 * 60, endMinute - 1);

  // 58% orders fall into the two common cafe peaks.
  let minute: number;
  if (random.chance(0.34) && endMinute > 9 * 60) {
    minute = random.int(7 * 60, Math.min(10 * 60, endMinute));
  } else if (random.chance(0.36) && endMinute > 16 * 60) {
    minute = random.int(16 * 60, Math.min(20 * 60, endMinute));
  } else {
    minute = random.int(Math.max(0, startMinute), endMinute);
  }

  const result = new Date(day);
  result.setHours(Math.floor(minute / 60), minute % 60, random.int(0, 59), 0);
  return result;
}

function fulfillmentForAge(ageInDays: number, random: Random): FulfillmentStatus {
  if (ageInDays === 0) {
    return random.weighted([
      [FulfillmentStatus.PENDING_PAYMENT, 8],
      [FulfillmentStatus.QUEUED, 8],
      [FulfillmentStatus.PREPARING, 8],
      [FulfillmentStatus.READY, 8],
      [FulfillmentStatus.DELIVERED, 63],
      [FulfillmentStatus.CANCELLED, 5],
    ]);
  }
  if (ageInDays <= 2) {
    return random.weighted([
      [FulfillmentStatus.PENDING_PAYMENT, 3],
      [FulfillmentStatus.QUEUED, 2],
      [FulfillmentStatus.PREPARING, 2],
      [FulfillmentStatus.READY, 3],
      [FulfillmentStatus.DELIVERED, 85],
      [FulfillmentStatus.CANCELLED, 5],
    ]);
  }
  return random.weighted([
    [FulfillmentStatus.PENDING_PAYMENT, 1],
    [FulfillmentStatus.DELIVERED, 94],
    [FulfillmentStatus.CANCELLED, 5],
  ]);
}

function paymentForFulfillment(
  fulfillmentStatus: FulfillmentStatus,
  random: Random,
): { method: PaymentMethod | null; status: PaymentStatus } {
  if (fulfillmentStatus === FulfillmentStatus.CANCELLED) {
    return { method: null, status: PaymentStatus.UNPAID };
  }
  if (fulfillmentStatus !== FulfillmentStatus.PENDING_PAYMENT) {
    return {
      method: random.chance(0.68) ? PaymentMethod.QR : PaymentMethod.CASH,
      status: PaymentStatus.PAID,
    };
  }

  const status = random.weighted([
    [PaymentStatus.UNPAID, 42],
    [PaymentStatus.PENDING, 16],
    [PaymentStatus.UNDERPAID, 16],
    [PaymentStatus.OVERPAID, 10],
    [PaymentStatus.REVIEW, 16],
  ]);
  return {
    method: status === PaymentStatus.UNPAID && random.chance(0.45) ? null : PaymentMethod.QR,
    status,
  };
}

async function createManyInBatches<T>(
  data: T[],
  create: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < data.length; index += BATCH_SIZE) {
    await create(data.slice(index, index + BATCH_SIZE));
  }
}

async function seedMenu(prisma: PrismaClient): Promise<MenuSeedItem[]> {
  const items: MenuSeedItem[] = [];

  for (const [categoryIndex, category] of MENU.entries()) {
    const categoryRecord = await prisma.menuCategory.upsert({
      where: { name: category.name },
      create: {
        id: deterministicUuid(`menu-category:${category.name}`),
        name: category.name,
        displayOrder: 100 + categoryIndex,
        isActive: true,
      },
      update: { displayOrder: 100 + categoryIndex, isActive: true },
      select: { id: true },
    });

    for (const [itemIndex, [name, price]] of category.items.entries()) {
      const id = deterministicUuid(`menu-item:${category.name}:${name}`);
      const item = await prisma.menuItem.upsert({
        where: { id },
        create: {
          id,
          categoryId: categoryRecord.id,
          name,
          description: "Món mẫu phục vụ kiểm thử dashboard và báo cáo local.",
          price: BigInt(price),
          isAvailable: true,
          displayOrder: itemIndex,
        },
        update: {
          categoryId: categoryRecord.id,
          name,
          price: BigInt(price),
          isAvailable: true,
          displayOrder: itemIndex,
        },
        select: { id: true, name: true, price: true },
      });
      items.push(item);
    }
  }

  return items;
}

async function main(): Promise<void> {
  const target = configureLocalDockerDatabase();
  const days = parseIntegerEnv("SEED_VISUALIZATION_DAYS", DEFAULT_DAYS, 7, 730);
  const ordersPerDay = parseIntegerEnv(
    "SEED_VISUALIZATION_ORDERS_PER_DAY",
    DEFAULT_ORDERS_PER_DAY,
    5,
    200,
  );
  const randomSeed = parseIntegerEnv(
    "SEED_VISUALIZATION_RANDOM_SEED",
    DEFAULT_RANDOM_SEED,
    1,
    2_147_483_647,
  );
  const random = createRandom(randomSeed);
  const seedRunAt = new Date();
  const atOrBeforeSeedRun = (date: Date): Date =>
    date.getTime() > seedRunAt.getTime() ? new Date(seedRunAt) : date;
  const prisma = new PrismaClient();

  try {
    const users = await prisma.user.findMany({
      where: { status: UserStatus.ACTIVE },
      select: { id: true, fullName: true, role: true, telegramChatId: true },
      orderBy: { createdAt: "asc" },
    });
    const serviceStaff = users.filter((user) => user.role === UserRole.SERVICE_STAFF);
    const baristas = users.filter((user) => user.role === UserRole.BARISTA);
    const ownersWithChat = users.filter(
      (user) => user.role === UserRole.OWNER && user.telegramChatId !== null,
    );

    if (serviceStaff.length === 0 || baristas.length === 0) {
      throw new Error(
        "Visualization seed requires at least one existing ACTIVE SERVICE_STAFF and one existing ACTIVE BARISTA. No users were created or changed.",
      );
    }

    console.info(
      `Seeding visualization data into ${target} with ${serviceStaff.length} service staff and ${baristas.length} barista(s)...`,
    );

    const [deletedNotifications, deletedOrders] = await prisma.$transaction([
      prisma.notification.deleteMany({
        where: {
          OR: [
            { sourceKey: { startsWith: NOTIFICATION_SOURCE_PREFIX } },
            { order: { is: { orderCode: { startsWith: ORDER_PREFIX } } } },
          ],
        },
      }),
      prisma.order.deleteMany({
        where: { orderCode: { startsWith: ORDER_PREFIX } },
      }),
    ]);
    console.info(
      `Removed previous visualization seed: ${deletedOrders.count} orders, ${deletedNotifications.count} notifications.`,
    );

    const menuItems = await seedMenu(prisma);
    const orders: Prisma.OrderCreateManyInput[] = [];
    const orderItems: Prisma.OrderItemCreateManyInput[] = [];
    const payments: Prisma.PaymentCreateManyInput[] = [];
    const histories: Prisma.OrderStatusHistoryCreateManyInput[] = [];
    const notifications: Prisma.NotificationCreateManyInput[] = [];
    const today = startOfDay(new Date());
    let sequence = 0;
    let paidRevenue = 0n;

    const addHistory = (
      orderId: string,
      statusDomain: OrderStatusDomain,
      oldStatus: string | null,
      newStatus: string,
      changedByUserId: string | null,
      createdAt: Date,
      reason: string | null = null,
    ): void => {
      histories.push({
        id: deterministicUuid(`history:${orderId}:${statusDomain}:${newStatus}:${createdAt.toISOString()}`),
        orderId,
        statusDomain,
        oldStatus,
        newStatus,
        changedByUserId,
        reason,
        createdAt,
      });
    };

    const addNotification = (
      orderId: string,
      orderCode: string,
      event: NotificationEvent,
      recipient: SeedUser,
      eventAt: Date,
    ): void => {
      if (recipient.telegramChatId === null) return;
      const sourceKey = `${NOTIFICATION_SOURCE_PREFIX}${orderCode}:${event}`;
      const failed = random.chance(0.035);
      const updatedAt = atOrBeforeSeedRun(addMinutes(eventAt, failed ? 15 : 1));
      notifications.push({
        id: deterministicUuid(`notification:${sourceKey}:${recipient.id}`),
        event,
        status: failed ? NotificationStatus.FAILED : NotificationStatus.SENT,
        sourceKey,
        orderId,
        recipientUserId: recipient.id,
        recipientTelegramChatId: recipient.telegramChatId,
        message: `[DỮ LIỆU DEMO] ${event} cho đơn ${orderCode}`,
        attemptCount: failed ? 5 : 1,
        lastError: failed ? "Demo: Telegram timeout after retry limit" : null,
        sentAt: failed ? null : updatedAt,
        createdAt: eventAt,
        updatedAt,
      });
    };

    for (let ageInDays = days - 1; ageInDays >= 0; ageInDays -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - ageInDays);
      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      const seasonalFactor = 0.82 + ((days - ageInDays) / days) * 0.28;
      const dailyVariation = 0.82 + random.next() * 0.36;
      const dailyCount = Math.max(
        1,
        Math.round(ordersPerDay * (isWeekend ? 1.24 : 1) * seasonalFactor * dailyVariation),
      );

      for (let dailySequence = 1; dailySequence <= dailyCount; dailySequence += 1) {
        sequence += 1;
        const datePart = `${String(day.getFullYear()).slice(-2)}${String(day.getMonth() + 1).padStart(2, "0")}${String(day.getDate()).padStart(2, "0")}`;
        const orderCode = `${ORDER_PREFIX}${datePart}-${String(dailySequence).padStart(4, "0")}`;
        const orderId = deterministicUuid(`order:${orderCode}`);
        const creator = random.pick(serviceStaff);
        const createdAt = atOrBeforeSeedRun(timestampForDay(day, ageInDays === 0, random));
        const fulfillmentStatus = fulfillmentForAge(ageInDays, random);
        const paymentState = paymentForFulfillment(fulfillmentStatus, random);
        const assignedBarista = BARISTA_ASSIGNED_STATUSES.includes(fulfillmentStatus)
          ? random.pick(baristas)
          : null;

        const chosenMenuItemIds = new Set<string>();
        const lineCount = random.weighted([
          [1, 34],
          [2, 41],
          [3, 20],
          [4, 5],
        ]);
        let totalAmount = 0n;
        for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
          let menuItem = random.pick(menuItems);
          while (chosenMenuItemIds.has(menuItem.id)) menuItem = random.pick(menuItems);
          chosenMenuItemIds.add(menuItem.id);
          const quantity = random.weighted([
            [1, 72],
            [2, 23],
            [3, 5],
          ]);
          totalAmount += menuItem.price * BigInt(quantity);
          orderItems.push({
            id: deterministicUuid(`order-item:${orderCode}:${lineIndex}`),
            orderId,
            menuItemId: menuItem.id,
            itemName: menuItem.name,
            unitPrice: menuItem.price,
            quantity,
            note: random.pick(ITEM_NOTES),
          });
        }

        const timeline: Timeline = {
          paidAt:
            paymentState.status === PaymentStatus.PAID
              ? atOrBeforeSeedRun(addMinutes(createdAt, random.int(1, 8)))
              : null,
          preparingAt: null,
          readyAt: null,
          deliveredAt: null,
          cancelledAt:
            fulfillmentStatus === FulfillmentStatus.CANCELLED
              ? atOrBeforeSeedRun(addMinutes(createdAt, random.int(2, 15)))
              : null,
        };
        if (timeline.paidAt) {
          timeline.preparingAt = atOrBeforeSeedRun(
            addMinutes(timeline.paidAt, random.int(2, 12)),
          );
          timeline.readyAt = atOrBeforeSeedRun(
            addMinutes(timeline.preparingAt, random.int(4, 18)),
          );
          timeline.deliveredAt = atOrBeforeSeedRun(
            addMinutes(timeline.readyAt, random.int(1, 8)),
          );
        }

        let updatedAt = createdAt;
        if (fulfillmentStatus === FulfillmentStatus.CANCELLED && timeline.cancelledAt) {
          updatedAt = timeline.cancelledAt;
        } else if (fulfillmentStatus === FulfillmentStatus.QUEUED && timeline.paidAt) {
          updatedAt = atOrBeforeSeedRun(addMinutes(timeline.paidAt, 1));
        } else if (fulfillmentStatus === FulfillmentStatus.PREPARING && timeline.preparingAt) {
          updatedAt = timeline.preparingAt;
        } else if (fulfillmentStatus === FulfillmentStatus.READY && timeline.readyAt) {
          updatedAt = timeline.readyAt;
        } else if (fulfillmentStatus === FulfillmentStatus.DELIVERED && timeline.deliveredAt) {
          updatedAt = timeline.deliveredAt;
        } else if (paymentState.status !== PaymentStatus.UNPAID) {
          updatedAt = atOrBeforeSeedRun(addMinutes(createdAt, random.int(1, 5)));
        }

        const cancellationReason =
          fulfillmentStatus === FulfillmentStatus.CANCELLED
            ? random.pick(CANCELLATION_REASONS)
            : null;
        orders.push({
          id: orderId,
          orderCode,
          createdByUserId: creator.id,
          assignedBaristaId: assignedBarista?.id ?? null,
          paymentMethod: paymentState.method,
          paymentStatus: paymentState.status,
          fulfillmentStatus,
          totalAmount,
          customerNote: random.pick(CUSTOMER_NOTES),
          cancellationReason,
          paidAt: timeline.paidAt,
          createdAt,
          updatedAt,
        });

        addHistory(
          orderId,
          OrderStatusDomain.PAYMENT,
          null,
          PaymentStatus.UNPAID,
          creator.id,
          createdAt,
        );
        addHistory(
          orderId,
          OrderStatusDomain.FULFILLMENT,
          null,
          FulfillmentStatus.PENDING_PAYMENT,
          creator.id,
          createdAt,
        );

        if (paymentState.status === PaymentStatus.PAID && timeline.paidAt) {
          paidRevenue += totalAmount;
          addHistory(
            orderId,
            OrderStatusDomain.PAYMENT,
            PaymentStatus.UNPAID,
            PaymentStatus.PAID,
            paymentState.method === PaymentMethod.CASH ? creator.id : null,
            timeline.paidAt,
          );
          addHistory(
            orderId,
            OrderStatusDomain.FULFILLMENT,
            FulfillmentStatus.PENDING_PAYMENT,
            FulfillmentStatus.QUEUED,
            creator.id,
            atOrBeforeSeedRun(addMinutes(timeline.paidAt, 1)),
          );
          addNotification(orderId, orderCode, NotificationEvent.ORDER_PAID, creator, timeline.paidAt);
        } else if (paymentState.status !== PaymentStatus.UNPAID) {
          const anomalyAt = atOrBeforeSeedRun(addMinutes(createdAt, random.int(1, 5)));
          addHistory(
            orderId,
            OrderStatusDomain.PAYMENT,
            PaymentStatus.UNPAID,
            paymentState.status,
            null,
            anomalyAt,
            "Giao dịch demo cần đối soát",
          );
          for (const owner of ownersWithChat) {
            addNotification(
              orderId,
              orderCode,
              NotificationEvent.PAYMENT_REVIEW,
              owner,
              anomalyAt,
            );
          }
        }

        if (timeline.preparingAt && BARISTA_ASSIGNED_STATUSES.includes(fulfillmentStatus)) {
          addHistory(
            orderId,
            OrderStatusDomain.FULFILLMENT,
            FulfillmentStatus.QUEUED,
            FulfillmentStatus.PREPARING,
            assignedBarista!.id,
            timeline.preparingAt,
          );
        }
        if (timeline.readyAt && READY_OR_LATER_STATUSES.includes(fulfillmentStatus)) {
          addHistory(
            orderId,
            OrderStatusDomain.FULFILLMENT,
            FulfillmentStatus.PREPARING,
            FulfillmentStatus.READY,
            assignedBarista!.id,
            timeline.readyAt,
          );
          addNotification(orderId, orderCode, NotificationEvent.ORDER_READY, creator, timeline.readyAt);
        }
        if (timeline.deliveredAt && fulfillmentStatus === FulfillmentStatus.DELIVERED) {
          addHistory(
            orderId,
            OrderStatusDomain.FULFILLMENT,
            FulfillmentStatus.READY,
            FulfillmentStatus.DELIVERED,
            creator.id,
            timeline.deliveredAt,
          );
        }
        if (timeline.cancelledAt && fulfillmentStatus === FulfillmentStatus.CANCELLED) {
          addHistory(
            orderId,
            OrderStatusDomain.FULFILLMENT,
            FulfillmentStatus.PENDING_PAYMENT,
            FulfillmentStatus.CANCELLED,
            creator.id,
            timeline.cancelledAt,
            cancellationReason,
          );
        }

        if (paymentState.method !== null) {
          const paymentId = deterministicUuid(`payment:${orderCode}`);
          const receivedAmount =
            paymentState.status === PaymentStatus.PAID
              ? totalAmount
              : paymentState.status === PaymentStatus.UNDERPAID
                ? totalAmount - 5_000n
                : paymentState.status === PaymentStatus.OVERPAID
                  ? totalAmount + 10_000n
                  : paymentState.status === PaymentStatus.REVIEW
                    ? totalAmount + BigInt(random.pick([-10_000, 5_000]))
                    : 0n;
          payments.push({
            id: paymentId,
            orderId,
            paymentCode: paymentState.method === PaymentMethod.QR ? `VSP${datePart}${String(sequence).padStart(7, "0")}` : null,
            expectedAmount: totalAmount,
            receivedAmount,
            cashConfirmedByUserId:
              paymentState.method === PaymentMethod.CASH && paymentState.status === PaymentStatus.PAID
                ? creator.id
                : null,
            confirmedAt:
              paymentState.method === PaymentMethod.CASH && paymentState.status === PaymentStatus.PAID
                ? timeline.paidAt
                : null,
            createdAt: atOrBeforeSeedRun(addMinutes(createdAt, 1)),
            updatedAt,
          });
        }
      }
    }

    await createManyInBatches(orders, (data) => prisma.order.createMany({ data }));
    await createManyInBatches(orderItems, (data) => prisma.orderItem.createMany({ data }));
    await createManyInBatches(payments, (data) => prisma.payment.createMany({ data }));
    await createManyInBatches(histories, (data) => prisma.orderStatusHistory.createMany({ data }));
    await createManyInBatches(notifications, (data) => prisma.notification.createMany({ data }));

    console.info("Visualization seed completed", {
      target,
      days,
      menuItems: menuItems.length,
      orders: orders.length,
      orderItems: orderItems.length,
      payments: payments.length,
      histories: histories.length,
      notifications: notifications.length,
      paidRevenueVnd: paidRevenue.toString(),
      usersCreatedOrUpdated: 0,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Visualization seed failed", error);
  process.exitCode = 1;
});
