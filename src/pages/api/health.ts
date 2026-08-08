/**
 * GET /api/health
 *
 * Reports whether the app can currently reach CognoDB. Used by the UI error
 * boundary and handy when verifying a fresh deployment.
 *
 * Answers 200 when connected and 503 when not, so it doubles as an uptime
 * check that does not need its body parsed.
 */

import type { APIRoute } from 'astro';
import { checkHealth } from '../../lib/cognodb';

export const GET: APIRoute = async () => {
  const health = await checkHealth();

  if (health.ok) {
    return new Response(
      JSON.stringify({
        data: {
          database: 'connected',
          agent: health.agent,
          protocolVersion: health.protocolVersion,
        },
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      },
    );
  }

  // The code is useful to us in logs; the visitor only learns that the graph
  // is temporarily out of reach.
  console.error(`[api/health] database unreachable (${health.code}): ${health.message}`);

  return new Response(
    JSON.stringify({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Could not reach the graph database.',
      },
    }),
    {
      status: 503,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'retry-after': '5',
      },
    },
  );
};
