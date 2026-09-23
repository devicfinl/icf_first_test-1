import type { NextFunction, Request, Response } from "express";

type RequestOverrides = Partial<{
  body: unknown;
  query: unknown;
  params: unknown;
  auth: Request["auth"];
}>;

/** A minimal Express Request stand-in: only the fields the middlewares and controllers under test read. */
export function makeReq(overrides: RequestOverrides = {}): Request {
  return {
    body: overrides.body,
    query: overrides.query ?? {},
    params: overrides.params ?? {},
    auth: overrides.auth,
  } as unknown as Request;
}

export type FakeResponse = Response & { statusCode: number; body: any };

/** A minimal Express Response stand-in that records the status and json body sent to it. */
export function makeRes(): FakeResponse {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as FakeResponse;
}

/** Runs a middleware and reports whether it called `next()`, so a test can assert either path. */
export async function runMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => unknown,
  req: Request,
  res: Response,
): Promise<{ calledNext: boolean; res: FakeResponse }> {
  let calledNext = false;
  await middleware(req, res, () => {
    calledNext = true;
  });
  return { calledNext, res: res as FakeResponse };
}
