/**
 * Relationship names as a reader should see them.
 *
 * `HAS_SKILL` is the right name in Cypher and the wrong one on screen, and the
 * same edge needs different words depending on which end you are standing at:
 * from a `Talent` it is a skill, from the `Skill` it is a person who has it.
 * The maps below are keyed on `TYPE:direction` for that reason.
 *
 * Unknown types fall back to the type name in sentence case rather than
 * rendering a raw constant, so adding an edge to the schema degrades into
 * something readable instead of shouting `MENTORED_BY` at the user.
 */

const GROUP_TITLES: Record<string, string> = {
  'HAS_SKILL:out': 'Skills',
  'HAS_SKILL:in': 'People with this skill',
  'MEMBER_OF:out': 'Member of',
  'MEMBER_OF:in': 'Members',
  'COLLABORATED_ON:out': 'Worked on',
  'COLLABORATED_ON:in': 'Crew',
  'PRODUCED_BY:out': 'Produced by',
  'PRODUCED_BY:in': 'Projects produced',
};

/**
 * Short phrase for one hop of a path, read in the direction of travel.
 *
 * Keyed on the type *and* the label the reader is walking away from, because
 * every relationship here is traversed in both directions and the same type
 * needs opposite words on the way back. Query B is undirected, so a chain like
 * `Talent → Project → Talent` crosses `COLLABORATED_ON` forwards and then
 * backwards; labelling both "worked on" makes the second step read as though
 * the project employed the person's colleague.
 */
const EDGE_PHRASES: Record<string, string> = {
  'HAS_SKILL:Talent': 'has the skill',
  'HAS_SKILL:Skill': 'also held by',
  'MEMBER_OF:Talent': 'is a member of',
  'MEMBER_OF:Collective': 'also counts',
  'COLLABORATED_ON:Talent': 'worked on',
  'COLLABORATED_ON:Project': 'was also crewed by',
  'PRODUCED_BY:Project': 'was produced by',
  'PRODUCED_BY:Agency': 'also produced',
};

function sentenceCase(type: string): string {
  const words = type.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function groupTitle(type: string, direction: 'in' | 'out'): string {
  return GROUP_TITLES[`${type}:${direction}`] ?? sentenceCase(type);
}

/**
 * @param type the relationship crossed
 * @param fromLabel the label of the node the step starts at
 */
export function edgePhrase(type: string, fromLabel: string): string {
  return EDGE_PHRASES[`${type}:${fromLabel}`] ?? type.toLowerCase().replace(/_/g, ' ');
}

/**
 * Path length in words.
 *
 * Deliberately "hops", not "degrees of separation". The usual phrase counts the
 * people standing between two others, but nothing between two talents here is a
 * person — the schema is bipartite, so every intermediary is a project, agency,
 * collective or skill. Counting relationships is the claim the query actually
 * supports; the panel names the entities in the chain, which says more than any
 * single number.
 */
export function hopLabel(degrees: number): string {
  return `${degrees} hop${degrees === 1 ? '' : 's'}`;
}

/**
 * The same distance as a number of introductions, which is the form someone
 * looking for a way in actually wants.
 *
 * A talent-to-talent path alternates sides of the bipartite schema, so it always
 * has even length and every second node is a person — one introduction per pair
 * of hops. See `docs/database.md` §3 Query B. Odd lengths cannot occur between
 * two talents, and returning null rather than rounding keeps that assumption
 * from silently producing a wrong claim if the schema ever gains a
 * talent-to-talent edge.
 */
export function introductionLabel(degrees: number): string | null {
  if (degrees % 2 !== 0 || degrees < 2) return null;
  const count = degrees / 2;
  return count === 1 ? 'one introduction away' : `${count} introductions away`;
}
