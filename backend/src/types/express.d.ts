import type { SessionPosition } from "../utils/jwt.js";
import type { ValidatedRequest } from "../middlewares/validate.js";

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth so protected handlers can read the caller's identity and the committee
      // position they selected for this session (null until they pick one).
      auth?: { userId: string; jti: string; exp: number; position: SessionPosition | null };
      // Set by the validate middleware: the request's checked body, query and params.
      validated?: ValidatedRequest;
      // Set by requestContext: correlates every log line for one request.
      id?: string;
    }
  }
}

export {};
