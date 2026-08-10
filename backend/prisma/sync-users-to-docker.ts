import { existsSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";

import { PrismaClient, type User } from "@prisma/client";
import { config as loadDotenv } from "dotenv";

const DEFAULT_DOCKER_DATABASE_URL =
  "postgresql://order_flow:order_flow@localhost:5432/order_flow";
const BATCH_SIZE = 100;

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

interface ConnectionConfig {
  sourceUrl: string;
  targetUrl: string;
  sourceLabel: string;
  targetLabel: string;
}

function parsePostgresUrl(name: string, value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error(`${name} must use postgres:// or postgresql://`);
  }
  return url;
}

function databaseName(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0] ?? "");
}

function safeLabel(url: URL): string {
  return `${url.hostname}:${url.port || "5432"}/${databaseName(url)}`;
}

function getConnectionConfig(): ConnectionConfig {
  if (process.env.NODE_ENV?.toLowerCase() === "production") {
    throw new Error("User sync is disabled when NODE_ENV=production");
  }

  const sourceValue =
    process.env.SUPABASE_USERS_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!sourceValue) {
    throw new Error(
      "SUPABASE_USERS_DATABASE_URL or a Supabase DATABASE_URL is required as the read-only source",
    );
  }
  const targetValue =
    process.env.SEED_VISUALIZATION_DATABASE_URL?.trim() || DEFAULT_DOCKER_DATABASE_URL;
  const source = parsePostgresUrl("Supabase source URL", sourceValue);
  const target = parsePostgresUrl("Docker target URL", targetValue);

  if (!source.hostname.endsWith(".supabase.com")) {
    throw new Error("Source must be a Supabase PostgreSQL host ending in .supabase.com");
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (!localHosts.has(target.hostname) || databaseName(target) !== "order_flow") {
    throw new Error(
      "Target must be the Docker database order_flow exposed through localhost, 127.0.0.1, or ::1",
    );
  }

  return {
    sourceUrl: sourceValue,
    targetUrl: targetValue,
    sourceLabel: safeLabel(source),
    targetLabel: safeLabel(target),
  };
}

function sameUser(left: User, right: User): boolean {
  return (
    left.id === right.id &&
    left.fullName === right.fullName &&
    left.telegramUserId === right.telegramUserId &&
    left.telegramChatId === right.telegramChatId &&
    left.username === right.username &&
    left.passwordHash === right.passwordHash &&
    left.role === right.role &&
    left.status === right.status &&
    left.createdAt.getTime() === right.createdAt.getTime() &&
    left.updatedAt.getTime() === right.updatedAt.getTime()
  );
}

async function syncBatch(target: PrismaClient, users: User[]): Promise<void> {
  await target.$transaction(
    users.map((user) =>
      target.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          fullName: user.fullName,
          telegramUserId: user.telegramUserId,
          telegramChatId: user.telegramChatId,
          username: user.username,
          passwordHash: user.passwordHash,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        update: {
          fullName: user.fullName,
          telegramUserId: user.telegramUserId,
          telegramChatId: user.telegramChatId,
          username: user.username,
          passwordHash: user.passwordHash,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      }),
    ),
  );
}

async function main(): Promise<void> {
  const config = getConnectionConfig();
  const source = new PrismaClient({ datasourceUrl: config.sourceUrl });
  const target = new PrismaClient({ datasourceUrl: config.targetUrl });

  try {
    console.info(`Reading users from ${config.sourceLabel}...`);
    const sourceUsers = await source.user.findMany({ orderBy: { createdAt: "asc" } });
    if (sourceUsers.length === 0) {
      throw new Error("Supabase users table is empty; nothing was written to Docker");
    }

    const targetUsers = await target.user.findMany({ orderBy: { createdAt: "asc" } });
    const targetById = new Map(targetUsers.map((user) => [user.id, user]));
    const targetByUsername = new Map(
      targetUsers
        .filter((user) => user.username !== null)
        .map((user) => [user.username!, user.id]),
    );
    const targetByTelegramId = new Map(
      targetUsers
        .filter((user) => user.telegramUserId !== null)
        .map((user) => [user.telegramUserId!, user.id]),
    );

    const conflicts = sourceUsers.filter((user) => {
      const usernameOwner = user.username ? targetByUsername.get(user.username) : undefined;
      const telegramOwner =
        user.telegramUserId === null ? undefined : targetByTelegramId.get(user.telegramUserId);
      return (
        (usernameOwner !== undefined && usernameOwner !== user.id) ||
        (telegramOwner !== undefined && telegramOwner !== user.id)
      );
    });
    if (conflicts.length > 0) {
      throw new Error(
        `Found ${conflicts.length} Docker user(s) whose username or Telegram ID belongs to a different UUID. No users were written.`,
      );
    }

    const usersToWrite = sourceUsers.filter((user) => {
      const existing = targetById.get(user.id);
      return !existing || !sameUser(user, existing);
    });
    const created = usersToWrite.filter((user) => !targetById.has(user.id)).length;
    const updated = usersToWrite.length - created;

    for (let index = 0; index < usersToWrite.length; index += BATCH_SIZE) {
      await syncBatch(target, usersToWrite.slice(index, index + BATCH_SIZE));
    }

    const roleCounts = sourceUsers.reduce<Record<string, number>>((counts, user) => {
      counts[user.role] = (counts[user.role] ?? 0) + 1;
      return counts;
    }, {});
    console.info("Supabase users synchronized to Docker", {
      source: config.sourceLabel,
      target: config.targetLabel,
      sourceUsers: sourceUsers.length,
      created,
      updated,
      unchanged: sourceUsers.length - usersToWrite.length,
      deleted: 0,
      roleCounts,
    });
  } finally {
    await Promise.all([source.$disconnect(), target.$disconnect()]);
  }
}

main().catch((error: unknown) => {
  console.error("User sync failed", error);
  process.exitCode = 1;
});
