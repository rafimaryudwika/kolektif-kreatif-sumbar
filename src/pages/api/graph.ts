/**
 * GET /api/graph
 *
 * Query E. The entire graph in one response — every node and every edge.
 *
 * This is only reasonable because the dataset is 73 nodes and 161 edges. One
 * round trip beats paginating a canvas that has to lay out the whole thing
 * anyway, and it keeps the first paint to a single request. The moment the
 * dataset outgrows a comfortable payload, this becomes a seeded subgraph plus
 * `/api/node` expansion, which the explorer already supports.
 */

import type { APIRoute } from 'astro';
import { jsonOk, toErrorResponse } from '../../lib/api';
import { readQuery } from '../../lib/cognodb';
import { OVERVIEW_QUERY, type GraphOverview } from '../../lib/graph';

export const GET: APIRoute = async () => {
  try {
    const [overview] = await readQuery<GraphOverview>(OVERVIEW_QUERY);

    // The query's second MATCH yields no rows against a graph with no
    // relationships, which drops the nodes with it. That only happens on an
    // unseeded database, where an empty graph is the honest answer — better
    // than a 500 that hides the real problem, which is that nobody ran the seed.
    return jsonOk<GraphOverview>(overview ?? { nodes: [], edges: [] });
  } catch (error) {
    return toErrorResponse(error, 'api/graph');
  }
};
