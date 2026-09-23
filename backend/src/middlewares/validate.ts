import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { sendError, type ErrorDetail } from "../utils/response.js";

type Source = "body" | "query" | "params";

type Schemas = Partial<Record<Source, ZodType>>;

// Where the checked values land. `body` is also written back onto req.body, but req.query and
// req.params are getter-only in Express 5, so their parsed forms are only available here.
export interface ValidatedRequest {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

// Checks a request against zod schemas before any controller or service sees it, so the layers
// below can trust their input. Schemas built with z.strictObject also reject unknown fields,
// which keeps a client from smuggling in a property a future version might start reading.
//
// A failure is always a 400 with a field-by-field list; it never reaches the service layer.
export function validate(schemas: Schemas) {
  const sources = Object.keys(schemas) as Source[];

  return (req: Request, res: Response, next: NextFunction) => {
    const errors: ErrorDetail[] = [];
    const validated: ValidatedRequest = {};

    // params first, then query, then body: the most specific message wins in the common case
    // where a client gets several things wrong at once.
    for (const source of ["params", "query", "body"] as const) {
      if (!sources.includes(source)) continue;

      const result = schemas[source]!.safeParse(req[source] ?? {});

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            field: [source, ...issue.path.map(String)].join("."),
            message: issue.message,
          });
        }
        continue;
      }

      validated[source] = result.data;
    }

    if (errors.length > 0) {
      return sendError(res, 400, errors[0]!.message, errors);
    }

    req.validated = validated;
    if ("body" in validated) req.body = validated.body;

    next();
  };
}
