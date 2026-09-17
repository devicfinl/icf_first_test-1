// Set by requireAuth so protected handlers can read the caller's identity.
declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; jti: string; exp: number };
    }
  }
}

export {};
