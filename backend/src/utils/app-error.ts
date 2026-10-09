export class AppError extends Error {
  msg!: string;
  status!: number;
  additionalInfo!: Record<string, any>;

  constructor(msg: string, status = 500, additionalInfo: Record<string, any> = {}) {
    super(msg);
    this.name = "AppError";
    this.msg = msg;
    this.status = status;
    this.additionalInfo = additionalInfo;
  }

  get statusCode(): number {
    return this.status;
  }

  get details(): any {
    return this.additionalInfo;
  }

  static badRequest(message: string, details?: any) {
    return new AppError(message, 400, details);
  }

  static unauthorized(message: string) {
    return new AppError(message, 401);
  }

  static forbidden(message: string) {
    return new AppError(message, 403);
  }

  static notFound(message: string) {
    return new AppError(message, 404);
  }

  static tooManyRequests(message: string) {
    return new AppError(message, 429);
  }
}

export default AppError;

