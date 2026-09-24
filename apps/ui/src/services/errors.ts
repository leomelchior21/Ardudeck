/** Error type shared by the real API client and the browser demo backend. */
export class ApiError extends Error {
  readonly code: string;
  readonly hint: string | undefined;
  readonly details: string | undefined;
  readonly status: number;

  constructor(
    message: string,
    code: string,
    hint?: string,
    details?: string,
    status = 0,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.hint = hint;
    this.details = details;
    this.status = status;
  }
}
