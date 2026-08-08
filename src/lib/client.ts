/**
 * Browser-side counterpart to the response envelope in `src/lib/api.ts`.
 *
 * Every island fetches through `apiGet`, so the three ways a request can fail —
 * the network never reaching us, a non-JSON body, or a route answering with
 * `{ error }` — all arrive as one `ApiRequestError` carrying a sentence that is
 * safe to render. Components branch on `.code` when they want to say something
 * more specific.
 *
 * The import below must stay `import type`. `api.ts` pulls in the driver
 * singleton, and a value import here would drag the database client into the
 * client bundle.
 */

import type { ApiResponse } from './api';

export class ApiRequestError extends Error {
  readonly code: string;
  /** 0 when the request never got a response at all. */
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }

  /** True when retrying is worth offering: offline, or the database is down. */
  get retryable(): boolean {
    return this.code === 'NETWORK_ERROR' || this.status === 503;
  }
}

const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Could not reach the server. Check your connection and try again.',
  MALFORMED_RESPONSE: 'The server sent something unexpected. Try again in a moment.',
};

export async function apiGet<T>(
  path: string,
  params: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: 'application/json' }, signal });
  } catch (error) {
    // An aborted request is a superseded keystroke, not a failure. It goes back
    // to the caller as-is so nothing renders an error for it.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError(MESSAGES.NETWORK_ERROR!, 'NETWORK_ERROR', 0);
  }

  let body: ApiResponse<T> | null = null;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    body = null;
  }

  if (body && 'error' in body) {
    throw new ApiRequestError(body.error.message, body.error.code, response.status);
  }

  // A non-2xx without our envelope means something upstream of the route
  // answered — a platform error page, say. There is nothing specific to report.
  if (!response.ok || !body || !('data' in body)) {
    throw new ApiRequestError(
      MESSAGES.MALFORMED_RESPONSE!,
      'MALFORMED_RESPONSE',
      response.status,
    );
  }

  return body.data;
}

/** Renders any thrown value as a sentence, without leaking internals. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : MESSAGES.MALFORMED_RESPONSE!;
}
