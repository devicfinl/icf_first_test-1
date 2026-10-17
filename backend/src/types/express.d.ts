import type { ValidatedRequest } from "../middlewares/validate.js";
import type { AuthUser } from "./rbac.js";

declare global {
  namespace Express {
    interface Request {
      // The authenticated caller identity, permissions, and active position
      user?: AuthUser;
      auth?: AuthUser; // Backward-compatible alias
      // Set by the validate middleware: the request's checked body, query and params.
      validated?: ValidatedRequest;
      // Set by requestContext: correlates every log line for one request.
      id?: string;
    }
  }
}

export {};
