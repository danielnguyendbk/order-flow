export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ACCOUNT_INACTIVE"
  | "INVALID_TELEGRAM_DATA"
  | "NOT_FOUND"
  | "SERVICE_UNAVAILABLE";

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  ACCOUNT_INACTIVE: 403,
  INVALID_TELEGRAM_DATA: 401,
  NOT_FOUND: 404,
  SERVICE_UNAVAILABLE: 503,
};

export class AppError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppError";
    this.statusCode = statusByCode[code];
  }
}
