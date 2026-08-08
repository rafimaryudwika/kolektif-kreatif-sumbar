/**
 * Single source of truth for the CognoDB connection.
 *
 * CognoDB speaks openCypher over Bolt, so the official `neo4j-driver` is used
 * as-is. The driver is created once per server instance and reused across
 * requests: on Vercel each warm serverless invocation shares this module, and
 * building a fresh driver per request would leak sockets against the free
 * tier's 200-connection ceiling.
 *
 * Callers get two entry points, `readQuery` and `writeQuery`. Both take Cypher
 * plus a parameter object and never interpolate values into the query string.
 */

import neo4j, { Neo4jError, type Driver, type RecordShape } from 'neo4j-driver';

/** Thrown when the connection details are absent or malformed. */
export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

/**
 * Thrown when CognoDB cannot be reached, refuses the credentials, or times
 * out. Carries a message that is safe to show a user; the underlying driver
 * error is kept on `cause` for logging.
 */
export class DatabaseUnavailableError extends Error {
  readonly code: string;

  constructor(message: string, code: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'DatabaseUnavailableError';
    this.code = code;
  }
}

/**
 * Driver error codes that mean "the database is not answering right now"
 * rather than "your query is wrong". These are the ones worth surfacing to a
 * user as a connection problem.
 */
const UNAVAILABLE_CODES = new Set([
  'ServiceUnavailable',
  'SessionExpired',
  'Neo.ClientError.Security.Unauthorized',
  'Neo.ClientError.Security.AuthenticationRateLimit',
  'Neo.TransientError.General.DatabaseUnavailable',
  'Neo.TransientError.Transaction.DeadlockDetected',
]);

function readConfig() {
  const url = process.env.COGNODB_URL;
  const username = process.env.COGNODB_USERNAME;
  const password = process.env.COGNODB_PASSWORD;

  const missing = [
    ['COGNODB_URL', url],
    ['COGNODB_USERNAME', username],
    ['COGNODB_PASSWORD', password],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new DatabaseConfigError(
      `Missing environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in your CognoDB connection details.',
    );
  }

  return { url: url!, username: username!, password: password! };
}

let driver: Driver | null = null;

/** Returns the process-wide driver, creating it on first use. */
export function getDriver(): Driver {
  if (driver) return driver;

  const { url, username, password } = readConfig();

  driver = neo4j.driver(url, neo4j.auth.basic(username, password), {
    // Return Cypher integers as plain JS numbers. Every integer this app
    // stores (project year, hop counts, aggregate counts) is far inside the
    // safe range, and this keeps API responses JSON-serialisable without a
    // conversion pass over every record.
    disableLosslessIntegers: true,

    // Sized for the free c0 tier: 0.5 vCPU, 256 MB RAM, 200 connections
    // shared across every concurrent serverless instance.
    maxConnectionPoolSize: 10,
    connectionAcquisitionTimeout: 10_000,
    connectionTimeout: 10_000,
    maxTransactionRetryTime: 8_000,
  });

  return driver;
}

/** Wraps driver failures in our own error types, leaving query bugs intact. */
function rethrow(error: unknown): never {
  if (error instanceof DatabaseConfigError) throw error;

  if (error instanceof Neo4jError && UNAVAILABLE_CODES.has(error.code)) {
    // Deliberately generic: an authentication failure must not tell a visitor
    // that the password is wrong. The precise cause stays on `code` and
    // `cause` for the server log and the health endpoint.
    throw new DatabaseUnavailableError(
      'Could not reach the graph database.',
      error.code,
      error,
    );
  }

  // Anything else (syntax errors, constraint violations) is a bug in our own
  // Cypher and should surface loudly rather than be dressed up as an outage.
  throw error;
}

/**
 * Runs a read-only query in a managed read transaction.
 *
 * @param cypher Query text. Values must be supplied via `params`.
 * @param params Query parameters, passed to the driver rather than the string.
 */
export async function readQuery<T extends RecordShape = RecordShape>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const session = getDriver().session();
  try {
    const result = await session.executeRead((tx) => tx.run<T>(cypher, params));
    return result.records.map((record) => record.toObject() as T);
  } catch (error) {
    rethrow(error);
  } finally {
    await session.close();
  }
}

/** Runs a mutating query in a managed write transaction. See `readQuery`. */
export async function writeQuery<T extends RecordShape = RecordShape>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const session = getDriver().session();
  try {
    const result = await session.executeWrite((tx) => tx.run<T>(cypher, params));
    return result.records.map((record) => record.toObject() as T);
  } catch (error) {
    rethrow(error);
  } finally {
    await session.close();
  }
}

export type HealthStatus =
  | { ok: true; agent: string; protocolVersion: string }
  | { ok: false; code: string; message: string };

/** Cheap connectivity check for health endpoints and error boundaries. */
export async function checkHealth(): Promise<HealthStatus> {
  try {
    const info = await getDriver().getServerInfo();
    return {
      ok: true,
      agent: info.agent ?? 'unknown',
      protocolVersion: String(info.protocolVersion ?? 'unknown'),
    };
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      return { ok: false, code: 'ConfigError', message: error.message };
    }
    const code = error instanceof Neo4jError ? error.code : 'UnknownError';
    return {
      ok: false,
      code,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Closes the driver. Only for scripts that need the process to exit; request
 * handlers must never call this, since the driver is shared.
 */
export async function closeDriver(): Promise<void> {
  if (!driver) return;
  await driver.close();
  driver = null;
}
