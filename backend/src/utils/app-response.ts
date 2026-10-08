export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Standard application response envelope:
//   { success: true, message, data, pagination?, meta? }
export class AppResponse<T = unknown> {
  readonly success = true;
  readonly statusCode: number;
  readonly message: string;
  readonly data: T | null;
  readonly pagination?: PaginationMeta;
  readonly meta?: Record<string, unknown>;

  constructor(
    message: string,
    data: T | null = null,
    statusCode = 200,
    pagination?: PaginationMeta,
    meta?: Record<string, unknown>,
  ) {
    this.message = message;
    this.data = data;
    this.statusCode = statusCode;
    this.pagination = pagination;
    this.meta = meta;
  }

  toJSON() {
    return {
      success: this.success,
      message: this.message,
      data: this.data,
      ...(this.pagination ? { pagination: this.pagination } : {}),
      ...(this.meta ? { meta: this.meta } : {}),
    };
  }
}
