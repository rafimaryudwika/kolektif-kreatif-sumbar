/**
 * Graph vocabulary shared by every API route: the node shapes the client
 * receives, and the Cypher that produces them.
 *
 * The queries live here rather than inline in each route so that the set can be
 * diffed against `docs/database.md` §3 in one place — the spec claims these are
 * verbatim, and keeping them together is what makes that claim checkable.
 *
 * Every value reaches the database as a driver parameter. Nothing in this file
 * concatenates or interpolates into a query string.
 */

/** The five labels this app addresses. Anything else is not a graph node here. */
export const NODE_LABELS = ['Talent', 'Project', 'Agency', 'Collective', 'Skill'] as const;

export type NodeLabel = (typeof NODE_LABELS)[number];

/**
 * A node as the client sees it. `name` is already resolved from `name` or
 * `title` server-side, so nothing downstream has to know that `Project` spells
 * it differently.
 */
export interface GraphNode {
  id: string;
  label: NodeLabel;
  name: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  /** Present on `COLLABORATED_ON` only; null elsewhere. */
  role: string | null;
}

/** Query A: multi-hop network traversal. */
export const RECOMMENDATIONS_QUERY = `
MATCH (t1:Talent {id: $talentId})-[c1:COLLABORATED_ON]->(p1:Project)
      -[:PRODUCED_BY]->(agency:Agency)
MATCH (agency)<-[:PRODUCED_BY]-(p2:Project)
      <-[c2:COLLABORATED_ON]-(t2:Talent)-[:HAS_SKILL]->(s:Skill {name: $skill})
WHERE t1 <> t2
RETURN DISTINCT
  t2.id       AS talentId,
  t2.name     AS talentName,
  t2.role     AS talentRole,
  c2.role     AS roleOnProject,
  s.name      AS skill,
  agency.name AS viaAgency,
  p1.title    AS yourProject,
  p2.title    AS theirProject
ORDER BY talentName
LIMIT 20`;

export interface RecommendationRow {
  talentId: string;
  talentName: string;
  talentRole: string;
  roleOnProject: string;
  skill: string;
  viaAgency: string;
  yourProject: string;
  theirProject: string;
}

/** One route by which a recommended talent is connected to the requester. */
export interface Connection {
  viaAgency: string;
  yourProject: string;
  theirProject: string;
  roleOnProject: string;
}

export interface Recommendation {
  talentId: string;
  talentName: string;
  talentRole: string;
  skill: string;
  connections: Connection[];
}

/**
 * Collapses the query's evidence rows into one entry per talent.
 *
 * `DISTINCT` in Query A applies to the whole tuple, so someone connected
 * through three different agencies comes back three times. Each of those rows
 * is a genuine and separate reason, worth keeping — but a list of people should
 * name each person once, with their reasons attached, rather than repeating
 * them. Row order is preserved, so the `ORDER BY talentName` from the query
 * still holds.
 */
export function groupRecommendations(rows: RecommendationRow[]): Recommendation[] {
  const byTalent = new Map<string, Recommendation>();

  for (const row of rows) {
    let entry = byTalent.get(row.talentId);
    if (!entry) {
      entry = {
        talentId: row.talentId,
        talentName: row.talentName,
        talentRole: row.talentRole,
        skill: row.skill,
        connections: [],
      };
      byTalent.set(row.talentId, entry);
    }
    entry.connections.push({
      viaAgency: row.viaAgency,
      yourProject: row.yourProject,
      theirProject: row.theirProject,
      roleOnProject: row.roleOnProject,
    });
  }

  return [...byTalent.values()];
}

/** Query B: shortest path between two talents. */
export const PATH_QUERY = `
MATCH (a:Talent {id: $fromId}), (b:Talent {id: $toId})
MATCH path = shortestPath((a)-[*..4]-(b))
RETURN
  length(path)                         AS degrees,
  [n IN nodes(path) | {
    id:    n.id,
    label: head(labels(n)),
    name:  coalesce(n.name, n.title)
  }]                                   AS pathNodes,
  [r IN relationships(path) | type(r)] AS pathTypes`;

export interface PathResult {
  degrees: number;
  pathNodes: GraphNode[];
  pathTypes: string[];
}

/**
 * Query C: one-hop neighbourhood, one query per label.
 *
 * Cypher cannot parameterize a label and this project forbids building the
 * query by concatenation, so the client's label selects a complete pre-written
 * query instead of becoming part of one. See `docs/database.md` §2.4.
 *
 * `OPTIONAL MATCH` is deliberate: an isolated node returns a row with an empty
 * neighbour list rather than no row at all, so the UI can draw the node and say
 * it has no connections instead of claiming it does not exist.
 */
function neighbourhoodQuery(label: NodeLabel): string {
  return `
MATCH (n:${label} {id: $nodeId})
OPTIONAL MATCH (n)-[r]-(m)
RETURN
  {id: n.id, label: head(labels(n)), name: coalesce(n.name, n.title)} AS node,
  collect(DISTINCT CASE WHEN m IS NULL THEN NULL ELSE {
    id:        m.id,
    label:     head(labels(m)),
    name:      coalesce(m.name, m.title),
    type:      type(r),
    role:      r.role,
    direction: CASE WHEN startNode(r) = n THEN 'out' ELSE 'in' END
  } END)                                                             AS neighbours`;
}

/**
 * The lookup table from `docs/database.md` §2.4: five complete queries, built
 * once at module load and keyed by label.
 *
 * On the one interpolation in this file. `neighbourhoodQuery` is not exported
 * and its parameter is typed `NodeLabel`, a union of five string literals, so
 * the compiler rejects any other argument — a request-supplied `string` cannot
 * be passed to it without failing `astro check`. The only call site is the map
 * below, iterating a module-level `as const` array. No request data reaches a
 * query string; a client's label only indexes this map, after `asNodeLabel`
 * has already rejected anything unrecognised.
 */
export const NEIGHBOURHOOD_BY_LABEL: Record<NodeLabel, string> = Object.fromEntries(
  NODE_LABELS.map((label) => [label, neighbourhoodQuery(label)]),
) as Record<NodeLabel, string>;

export interface Neighbour extends GraphNode {
  type: string;
  role: string | null;
  direction: 'in' | 'out';
}

export interface Neighbourhood {
  node: GraphNode;
  neighbours: Neighbour[];
}

/** Narrows an untrusted string to a label this app knows, or null. */
export function asNodeLabel(value: string): NodeLabel | null {
  return (NODE_LABELS as readonly string[]).includes(value) ? (value as NodeLabel) : null;
}

/** Query D: search. */
export const SEARCH_QUERY = `
MATCH (n)
WHERE (n:Talent OR n:Project OR n:Agency OR n:Collective OR n:Skill)
  AND toLower(coalesce(n.name, n.title)) CONTAINS toLower($term)
RETURN
  n.id                                              AS id,
  head(labels(n))                                   AS label,
  coalesce(n.name, n.title)                         AS name,
  coalesce(n.role, n.type, n.category, n.focus, '') AS detail
ORDER BY name
LIMIT 15`;

export interface SearchResult extends GraphNode {
  /** Role, project type, skill category, or collective focus — whichever exists. */
  detail: string;
}

/** Query E: the whole graph, small enough to ship in one response. */
export const OVERVIEW_QUERY = `
MATCH (n)
WHERE n:Talent OR n:Project OR n:Agency OR n:Collective OR n:Skill
WITH collect({
  id:    n.id,
  label: head(labels(n)),
  name:  coalesce(n.name, n.title)
}) AS nodes
MATCH (a)-[r]->(b)
RETURN nodes, collect({
  source: a.id,
  target: b.id,
  type:   type(r),
  role:   r.role
}) AS edges`;

export interface GraphOverview {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
