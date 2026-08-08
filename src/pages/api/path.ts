/**
 * GET /api/path?from=<slug>&to=<slug>
 *
 * Query B. Degrees of separation between two talents, up to the four-hop
 * budget, across projects, agencies, and collectives in any combination.
 */

import type { APIRoute } from 'astro';
import { BadRequestError, jsonOk, requireParam, toErrorResponse } from '../../lib/api';
import { readQuery } from '../../lib/cognodb';
import { PATH_QUERY, type PathResult } from '../../lib/graph';

export const GET: APIRoute = async ({ url }) => {
  try {
    const fromId = requireParam(url, 'from');
    const toId = requireParam(url, 'to');

    if (fromId === toId) {
      throw new BadRequestError(
        'Pick two different talents to trace a path between.',
        'SAME_TALENT',
      );
    }

    const [path] = await readQuery<PathResult>(PATH_QUERY, { fromId, toId });

    // No row means no route within four hops — a real answer about the graph,
    // not a failure, so it is a 200 the UI renders as "no known connection".
    // The client cannot tell that case from a mistyped id, which is fine: both
    // mean "nothing to draw".
    return jsonOk({ from: fromId, to: toId, path: path ?? null });
  } catch (error) {
    return toErrorResponse(error, 'api/path');
  }
};
