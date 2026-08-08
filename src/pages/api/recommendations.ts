/**
 * GET /api/recommendations?talentId=<slug>&skill=<skill name>
 *
 * Query A. Talents with the requested skill who share a production agency with
 * the given talent but have never worked with them directly.
 *
 * Each result carries the agency and project titles that connect the two, so
 * the UI can explain why someone surfaced instead of presenting a bare list.
 * Someone reachable through more than one agency appears once, with every route
 * listed under `connections`.
 */

import type { APIRoute } from 'astro';
import { jsonOk, requireParam, toErrorResponse } from '../../lib/api';
import { readQuery } from '../../lib/cognodb';
import {
  RECOMMENDATIONS_QUERY,
  groupRecommendations,
  type RecommendationRow,
} from '../../lib/graph';

export const GET: APIRoute = async ({ url }) => {
  try {
    const talentId = requireParam(url, 'talentId');
    const skill = requireParam(url, 'skill');

    const rows = await readQuery<RecommendationRow>(RECOMMENDATIONS_QUERY, { talentId, skill });

    // An empty list is a legitimate answer, not a 404: the talent exists and
    // simply has no one matching that skill in their agency network. The UI
    // says so rather than showing an error.
    return jsonOk({ talentId, skill, recommendations: groupRecommendations(rows) });
  } catch (error) {
    return toErrorResponse(error, 'api/recommendations');
  }
};
