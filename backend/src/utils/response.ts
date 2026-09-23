import type { Response } from "express";
import { AppError } from "./app-error.js";

// Every endpoint answers with the same envelope, so the client has one shape to handle:
//   { success, message, data, errors? }
// `data` is null on failure, and `errors` only appears when a request failed field-level validation.
export interface ErrorDetail {
  field: string;
  message: string;
}

export function sendSuccess<T>(res: Response, message: string, data: T | null = null, status = 200) {
  return res.status(status).json({ success: true, message, data });
}

export function sendError(res: Response, status: number, message: string, errors?: readonly ErrorDetail[]) {
  return res.status(status).json({
    success: false,
    message,
    data: null,
    ...(errors && errors.length > 0 ? { errors } : {}),
  });
}

// A thrown AppError keeps its own status and message; anything else is unexpected, so it is
// logged and the caller only sees a generic 500. Never pass a raw error message through: it can
// carry query fragments, file paths or connection strings.
export function handleError(res: Response, error: unknown, logLabel: string, fallbackMessage = "Internal server error") {
  if (error instanceof AppError) {
    return sendError(res, error.statusCode, error.message, error.details);
  }

  console.error(logLabel, error);
  return sendError(res, 500, fallbackMessage);
}
