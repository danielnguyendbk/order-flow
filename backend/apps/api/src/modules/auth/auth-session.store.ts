import type { Pool } from "pg";

export interface CachedAuthSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface RotateSessionInput {
  sessionId: string;
  userId: string;
  currentTokenHash: string;
  nextTokenHash: string;
  expiresAt: Date;
}

export interface AuthSessionStorePort {
  create(session: CachedAuthSession): Promise<void>;
  isActive(sessionId: string, userId: string): Promise<boolean>;
  rotate(input: RotateSessionInput): Promise<boolean>;
  revoke(sessionId: string, userId: string): Promise<void>;
  clear(): Promise<void>;
  list(): Promise<CachedAuthSession[]>;
}

/** In-memory implementation retained exclusively for isolated tests. */
export class MemoryAuthSessionStore implements AuthSessionStorePort {
  private readonly sessions = new Map<string, CachedAuthSession>();

  constructor(private readonly maxSessions = 10_000) {}

  async create(session: CachedAuthSession): Promise<void> {
    this.removeExpired();
    if (this.sessions.size >= this.maxSessions) this.sessions.delete(this.sessions.keys().next().value as string);
    this.sessions.set(session.id, { ...session });
  }

  async isActive(sessionId: string, userId: string): Promise<boolean> {
    return this.getActive(sessionId, userId) !== undefined;
  }

  async rotate(input: RotateSessionInput): Promise<boolean> {
    const session = this.getActive(input.sessionId, input.userId);
    if (!session || session.refreshTokenHash !== input.currentTokenHash) {
      this.sessions.delete(input.sessionId);
      return false;
    }
    this.sessions.set(input.sessionId, { ...session, refreshTokenHash: input.nextTokenHash, expiresAt: input.expiresAt });
    return true;
  }

  async revoke(sessionId: string, userId: string): Promise<void> {
    if (this.sessions.get(sessionId)?.userId === userId) this.sessions.delete(sessionId);
  }

  async clear(): Promise<void> { this.sessions.clear(); }

  async list(): Promise<CachedAuthSession[]> { this.removeExpired(); return [...this.sessions.values()]; }

  private getActive(sessionId: string, userId: string): CachedAuthSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId || session.expiresAt.getTime() <= Date.now()) {
      if (session && session.expiresAt.getTime() <= Date.now()) this.sessions.delete(sessionId);
      return undefined;
    }
    return session;
  }

  private removeExpired(): void {
    for (const [id, session] of this.sessions) if (session.expiresAt.getTime() <= Date.now()) this.sessions.delete(id);
  }
}

/** Shared PostgreSQL sessions with atomic refresh-token rotation. */
export class PostgresAuthSessionStore implements AuthSessionStorePort {
  constructor(private readonly pool: Pool) {}

  async create(session: CachedAuthSession): Promise<void> {
    await this.pool.query(
      `insert into public.auth_sessions
        (id, user_id, refresh_token_hash, expires_at, ip_address, user_agent)
       values ($1, $2, $3, $4, $5, $6)`,
      [session.id, session.userId, session.refreshTokenHash, session.expiresAt, session.ipAddress ?? null, session.userAgent ?? null],
    );
  }

  async isActive(sessionId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      "select 1 from public.auth_sessions where id = $1 and user_id = $2 and expires_at > now()",
      [sessionId, userId],
    );
    return result.rowCount === 1;
  }

  async rotate(input: RotateSessionInput): Promise<boolean> {
    const updated = await this.pool.query(
      `update public.auth_sessions
       set refresh_token_hash = $4, expires_at = $5, updated_at = now()
       where id = $1 and user_id = $2 and refresh_token_hash = $3 and expires_at > now()`,
      [input.sessionId, input.userId, input.currentTokenHash, input.nextTokenHash, input.expiresAt],
    );
    if (updated.rowCount === 1) return true;
    await this.revoke(input.sessionId, input.userId);
    return false;
  }

  async revoke(sessionId: string, userId: string): Promise<void> {
    await this.pool.query("delete from public.auth_sessions where id = $1 and user_id = $2", [sessionId, userId]);
  }

  async clear(): Promise<void> {
    await this.pool.query("delete from public.auth_sessions where expires_at <= now()");
  }

  async list(): Promise<CachedAuthSession[]> {
    const result = await this.pool.query<{
      id: string; user_id: string; refresh_token_hash: string; expires_at: Date; ip_address: string | null; user_agent: string | null;
    }>(
      "select id, user_id, refresh_token_hash, expires_at, ip_address::text, user_agent from public.auth_sessions where expires_at > now() order by expires_at asc",
    );
    return result.rows.map((session) => ({
      id: session.id,
      userId: session.user_id,
      refreshTokenHash: session.refresh_token_hash,
      expiresAt: session.expires_at,
      ipAddress: session.ip_address ?? undefined,
      userAgent: session.user_agent ?? undefined,
    }));
  }
}
