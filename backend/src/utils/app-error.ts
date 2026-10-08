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
}

export default AppError;
