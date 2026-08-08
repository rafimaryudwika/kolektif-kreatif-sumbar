/**
 * GET /api/search?q=<term>
 *
 * Query D. Case-insensitive substring match across all five labels, capped at
 * 15 rows. Backs the search bar that seeds the canvas and picks path endpoints.
 */

import type { APIRoute } from 'astro';
import { BadRequestError, jsonOk, requireParam, toErrorResponse } from '../../lib/api';
import { readQuery } from '../../lib/cognodb';
import { SEARCH_QUERY, type SearchResult } from '../../lib/graph';

/**
 * A single character matches most of the graph and the response is pure
 * overhead, so ask for two. Guards the free-tier instance from a keystroke
 * handler firing on every letter.
 */
const MIN_TERM_LENGTH = 2;

export const GET: APIRoute = async ({ url }) => {
  try {
    const term = requireParam(url, 'q');

    if (term.length < MIN_TERM_LENGTH) {
      throw new BadRequestError(
        `Search needs at least ${MIN_TERM_LENGTH} characters.`,
        'TERM_TOO_SHORT',
      );
    }

    const results = await readQuery<SearchResult>(SEARCH_QUERY, { term });

    return jsonOk({ term, results });
  } catch (error) {
    return toErrorResponse(error, 'api/search');
  }
};
