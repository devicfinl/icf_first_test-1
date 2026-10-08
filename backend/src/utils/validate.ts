import type { Request, Response } from "express";
import { validationResult } from "express-validator";
import { sendError } from "./response.js";

export function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    sendError(
      res,
      400,
      errors.array()[0]!.msg,
      errors.array().map((err) => ({
        field: (err as any).path || (err as any).param || "body",
        message: err.msg,
      })),
    );
    return false;
  }
  return true;
}
