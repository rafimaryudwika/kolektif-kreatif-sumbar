import type { GraphNode } from './graph.ts';

/**
 * The entities offered as one-click starting points on the landing page.
 *
 * These are hand-picked rather than derived from a query: the point of the row
 * is to teach the five node types in one glance, so it holds exactly one of
 * each, and each was chosen for having enough edges that the modal opens onto a
 * real neighbourhood instead of a near-empty card.
 *
 * Hand-picking means the ids can fall out of step with the dataset, which has
 * already happened once — two chips shipped pointing at nodes the seed never
 * wrote, and clicking them opened a modal reading "Unable to load connections".
 * `scripts/seed.ts` therefore resolves every id below against the graph it just
 * populated and fails the seed if one is missing or carries a different label.
 * Renaming a node here without renaming it there is caught by `npm run seed`.
 */
export const FEATURED_ENTITIES: readonly GraphNode[] = [
  { id: 'talent-rian-syahputra', label: 'Talent', name: 'Rian Syahputra' },
  { id: 'project-jejak-di-ngarai', label: 'Project', name: 'Jejak di Ngarai' },
  { id: 'agency-rumah-gadang-films', label: 'Agency', name: 'Rumah Gadang Films' },
  { id: 'collective-tiga-tungku', label: 'Collective', name: 'Tiga Tungku' },
  { id: 'skill-directing', label: 'Skill', name: 'Directing' },
] as const;
