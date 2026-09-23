// Thrown by services (and middleware) when a request breaks a rule; the controller turns it into
// an HTTP response with this status, so services never need to know about Express.
//
// Status codes carry meaning across every module, so pick from the same set everywhere:
//   400 the request itself is malformed or incomplete
//   401 the caller is not authenticated, or the credentials/token they gave are not good
//   403 the caller is authenticated but this particular thing is not theirs to do
//   404 the thing they asked for does not exist
//   429 they are going too fast, or have failed too many times
export class AppError extends Error {
  readonly statusCode: number;
  // Field-level explanations, used by validation failures. Never carries secrets.
  readonly details?: readonly { field: string; message: string }[];

  constructor(statusCode: number, message: string, details?: readonly { field: string; message: string }[]) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message: string, details?: readonly { field: string; message: string }[]) {
    return new AppError(400, message, details);
  }

  static unauthorized(message: string) {
    return new AppError(401, message);
  }

  static forbidden(message: string) {
    return new AppError(403, message);
  }

  static notFound(message: string) {
    return new AppError(404, message);
  }

  static tooManyRequests(message: string) {
    return new AppError(429, message);
  }
}
