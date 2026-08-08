/**
 * GET /api/node?id=<slug>&label=<Talent|Project|Agency|Collective|Skill>
 *
 * Query C. One node plus everything one hop away in either direction. Backs
 * both the inspector panel and "expand this node" on the canvas.
 *
 * `label` is required rather than derived from the id prefix. The slugs happen
 * to encode their type, but relying on that would couple every request to the
 * seed script's naming, and the client already knows the label from whatever
 * payload gave it the id.
 */

import type { APIRoute } from 'astro';
import {
  BadRequestError,
  NotFoundError,
  jsonOk,
  requireParam,
  toErrorResponse,
} from '../../lib/api';
import { readQuery } from '../../lib/cognodb';
import {
  NEIGHBOURHOOD_BY_LABEL,
  NODE_LABELS,
  asNodeLabel,
  type Neighbourhood,
} from '../../lib/graph';

export const GET: APIRoute = async ({ url }) => {
  try {
    const nodeId = requireParam(url, 'id');
    const rawLabel = requireParam(url, 'label');

    // Rejects anything outside the allowlist before it can index the query
    // table. The submitted value is not echoed back — the list of valid labels
    // is the useful half of the message, and reflecting arbitrary request text
    // into a response is a habit worth not having.
    const label = asNodeLabel(rawLabel);
    if (!label) {
      throw new BadRequestError(
        `Unknown node type. Expected one of: ${NODE_LABELS.join(', ')}.`,
        'UNKNOWN_LABEL',
      );
    }

    const [result] = await readQuery<Neighbourhood>(NEIGHBOURHOOD_BY_LABEL[label], { nodeId });

    // The query uses OPTIONAL MATCH, so a node with no connections still
    // returns a row with an empty neighbour list. No row at all therefore means
    // the node genuinely is not there.
    //
    // The id is echoed back, unlike the label above, because the caller needs
    // to know which lookup failed and there is no allowlist to name instead.
    // The response is JSON, so the value is escaped on the way out.
    if (!result) {
      throw new NotFoundError(`No ${label} with id "${nodeId}".`, 'NODE_NOT_FOUND');
    }

    return jsonOk<Neighbourhood>(result);
  } catch (error) {
    return toErrorResponse(error, 'api/node');
  }
};
