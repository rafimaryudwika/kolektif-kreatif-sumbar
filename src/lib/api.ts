/**
 * Shared response shape and error boundary for every route under
 * `src/pages/api/`.
 *
 * Each route stays a thin layer: validate input, run one Cypher query, hand
 * the result to `jsonOk`. Anything thrown along the way lands in
 * `toErrorResponse`, which decides the status code and strips internal detail
 * out of the payload so the client only ever sees something it can act on.
 */

import { DatabaseConfigError, DatabaseUnavailableError } from './cognodb';

export interface ApiError {
  code: string;
  message: string;
}

export type ApiResponse<T> = { data: T } | { error: ApiError };

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

/** 200 with the payload wrapped in `{ data }`. */
export function jsonOk<T>(data: T, headers?: Record<string, string>): Response {
  return json({ data }, 200, headers);
}

/** Thrown by a route when the caller's query parameters do not make sense. */
export class BadRequestError extends Error {
  readonly code: string;

  constructor(message: string, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'BadRequestError';
    this.code = code;
  }
}

/**
 * Maps a thrown value onto an HTTP response.
 *
 * The database being unreachable is a 503 with `Retry-After`, which is both
 * honest to the client and distinguishable from a bug on our side. Unexpected
 * errors are logged in full but answered with a generic 500 — a Cypher syntax
 * error must not leak query text to the browser.
 */
export function toErrorResponse(error: unknown, context: string): Response {
  if (error instanceof BadRequestError) {
    return json({ error: { code: error.code, message: error.message } }, 400);
  }

  if (error instanceof DatabaseUnavailableError) {
    console.error(`[${context}] database unavailable (${error.code})`, error.cause);
    return json(
      { error: { code: 'DATABASE_UNAVAILABLE', message: error.message } },
      503,
      { 'retry-after': '5' },
    );
  }

  if (error instanceof DatabaseConfigError) {
    console.error(`[${context}] ${error.message}`);
    return json(
      {
        error: {
          code: 'DATABASE_NOT_CONFIGURED',
          message: 'The server is missing its database configuration.',
        },
      },
      500,
    );
  }

  console.error(`[${context}] unexpected error`, error);
  return json(
    { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' } },
    500,
  );
}

/** Reads a required query parameter, or throws a 400-shaped error. */
export function requireParam(url: URL, name: string): string {
  const value = url.searchParams.get(name)?.trim();
  if (!value) {
    throw new BadRequestError(`Missing required query parameter "${name}".`, 'MISSING_PARAM');
  }
  return value;
}
