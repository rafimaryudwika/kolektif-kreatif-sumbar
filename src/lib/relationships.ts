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

/** Short phrase for one hop of a path, where direction is not known. */
const EDGE_PHRASES: Record<string, string> = {
  HAS_SKILL: 'skill',
  MEMBER_OF: 'member of',
  COLLABORATED_ON: 'worked on',
  PRODUCED_BY: 'produced by',
};

function sentenceCase(type: string): string {
  const words = type.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function groupTitle(type: string, direction: 'in' | 'out'): string {
  return GROUP_TITLES[`${type}:${direction}`] ?? sentenceCase(type);
}

export function edgePhrase(type: string): string {
  return EDGE_PHRASES[type] ?? type.toLowerCase().replace(/_/g, ' ');
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
