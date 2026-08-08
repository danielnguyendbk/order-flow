export const USER_ROLES = ["OWNER", "SERVICE_STAFF", "BARISTA"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface AuthUser {
  id: string;
  fullName: string;
  username: string | null;
  telegramUserId: string | null;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
}

export interface AuthUserWithPassword extends AuthUser {
  passwordHash: string | null;
}

export interface PublicAuthUser {
  id: string;
  fullName: string;
  username: string | null;
  telegramUserId: string | null;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export interface AuthSessionResult extends AuthTokens {
  user: PublicAuthUser;
}

export interface AccessIdentity {
  userId: string;
  sessionId: string;
  role: UserRole;
}

export type AccessRole = UserRole;

export interface TelegramIdentity {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  authDate: number;
}

export function toPublicAuthUser(user: AuthUser): PublicAuthUser {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    telegramUserId: user.telegramUserId,
    role: user.role,
  };
}
