// app/lib/translations/errors.ts
//
// Error classes for the translation layer.
//   `message` is user-safe (surfaced in API responses, toasts, logs).
//   `details` is server-only — include upstream bodies, status codes, stack
//   fragments here, but NEVER return them to the client (CLAUDE.md §6).

export class ApiBibleError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "ApiBibleError";
  }
}

export class EsvApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "EsvApiError";
  }
}

export class TranslationNotAvailableError extends Error {
  constructor(public readonly translation: string) {
    super("Translation unavailable");
    this.name = "TranslationNotAvailableError";
  }
}
