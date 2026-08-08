# Database Specification & Graph Data Model

## 1. Why a Graph Database?

The creative scene in West Sumatra is held together by relationships, not by
records. The questions people actually ask about it — *"who else has this
agency's directors worked with?"*, *"how do I get an introduction to that
colourist?"* — are questions about paths between entities. Those are exactly the
questions a relational schema answers badly.

### 1.1 Multi-hop discovery costs a join per hop

Finding animators who are indirectly connected to a director through a shared
production house means walking talent → project → agency → project → talent →
skill. In SQL, every one of those hops is another join:

```sql
-- Relational approach: eight joins to answer one question.
SELECT DISTINCT t2.name, s.name AS skill, a.name AS agency
FROM talents             t1
JOIN project_memberships pm1 ON pm1.talent_id  = t1.id
JOIN projects            p1  ON p1.id          = pm1.project_id
JOIN agencies            a   ON a.id           = p1.agency_id
JOIN projects            p2  ON p2.agency_id   = a.id
JOIN project_memberships pm2 ON pm2.project_id = p2.id
JOIN talents             t2  ON t2.id          = pm2.talent_id
JOIN talent_skills       ts  ON ts.talent_id   = t2.id
JOIN skills              s   ON s.id           = ts.skill_id
WHERE t1.name = $1
  AND s.name  = $2
  AND t2.id  <> t1.id;
```

The same traversal in Cypher is [Query A](#query-a-multi-hop-network-traversal)
below — one readable pattern, and the shape of the query mirrors the shape of
the question.

### 1.2 Shortest path is not expressible as a fixed join

The join count above is at least knowable in advance. Degrees of separation are
not: the answer might be two hops or five, and the path might run through a
project, an agency, or a shared collective. SQL has no fixed number of joins to
write, so it needs a recursive CTE that manually breadth-first searches the
graph, carries a visited-set to avoid cycling, and still has to be told where to
stop:

```sql
-- Relational approach: hand-rolled BFS, and this is the simplified version.
WITH RECURSIVE reachable(from_id, to_id, depth, visited) AS (
  SELECT id, id, 0, ARRAY[id] FROM talents WHERE id = $1
  UNION ALL
  SELECT r.from_id, e.to_id, r.depth + 1, r.visited || e.to_id
  FROM reachable r
  JOIN talent_edges e ON e.from_id = r.to_id
  WHERE r.depth < 4
    AND NOT e.to_id = ANY(r.visited)   -- cycle guard we must maintain ourselves
)
SELECT MIN(depth) FROM reachable WHERE to_id = $2;
```

That query also loses the thing we actually want to display: the path itself,
node by node. Cypher's `shortestPath()` returns it as a first-class value —
see [Query B](#query-b-shortest-path-between-two-talents).

> Verified on our instance: `shortestPath()`, `allShortestPaths()`, and
> variable-length patterns are all supported. `scripts/probe-cognodb.js`
> re-checks this against a live database.

### 1.3 Why it holds up at scale

* **Index-free adjacency** — each node stores direct references to its
  neighbours, so a hop is a pointer dereference. Traversal cost tracks the size
  of the neighbourhood, not the size of the table. Relational joins re-consult
  an index on every hop, and the intermediate result sets multiply.
* **The schema can grow sideways** — adding `(:Talent)-[:MENTORED_BY]->(:Talent)`
  is one new relationship type. In SQL it is a new table and a rewrite of every
  traversal query that should now consider it.
* **Relationships carry properties** — `COLLABORATED_ON { role: "Director of
  Photography" }` puts the role on the edge, where it belongs, instead of in a
  junction table that every query has to remember to join.

---

## 2. Schema Definition

### Nodes & Labels

| Label | Properties | Notes |
| --- | --- | --- |
| `Talent` | `id: String`, `name: String`, `role: String`, `location: String`, `bio: String` | `role` is the primary discipline (Director, DoP, Animator, Sound Designer, MUA, 3D Artist). `bio` feeds the inspector sidebar. |
| `Skill` | `id: String`, `name: String`, `category: String` | `name` is the semantic key — skills are shared, never duplicated per talent. `id` exists so that *every* node in the graph is addressable the same way; see §2.3. |
| `Project` | `id: String`, `title: String`, `year: Integer`, `type: String` | `type`: Film, Documentary, Commercial, Music Video, Animation. |
| `Agency` | `id: String`, `name: String`, `type: String`, `city: String` | Production houses and creative agencies. |
| `Collective` | `id: String`, `name: String`, `city: String`, `focus: String` | Informal groups. See §2.1 — these are what make the graph model earn its keep. |

### Typed Relationships

| Pattern | Properties |
| --- | --- |
| `(:Talent)-[:HAS_SKILL]->(:Skill)` | — |
| `(:Talent)-[:MEMBER_OF]->(:Collective)` | — |
| `(:Talent)-[:COLLABORATED_ON]->(:Project)` | `role: String` |
| `(:Project)-[:PRODUCED_BY]->(:Agency)` | — |

### 2.1 What `Collective` is for

`Collective` is deliberately not decoration. Formal work history
(`COLLABORATED_ON` → `PRODUCED_BY`) only connects people who were paid on the
same project. Collectives connect people who share a scene: film clubs, design
circles, music communities. Two talents with no shared credit can still be two
hops apart through a collective — one introduction, not a chain of them.

The seeded example is Yusra Hakim and Elok Permata: no shared project, no shared
skill, no shared agency, and exactly one node between them, `Tiga Tungku`. A
project-only query cannot reach that at any depth.

This matters for two reasons:

1. **Shortest paths get shorter and more truthful.** A path routed through
   `MEMBER_OF` is often the real-world introduction route, and it is invisible to
   any query that only looks at projects.
2. **It is the part a relational schema handles worst.** Affiliation and work
   history are different tables with different shapes, so a SQL "how are these
   two connected?" query has to enumerate every possible mix of both. Cypher
   traverses them uniformly — `[*..4]` does not care which relationship type it
   crosses.

### 2.2 Constraints & Indexes

Applied by the seed script before any data is written. Both forms are supported
on our instance (probe-verified), and `IF NOT EXISTS` keeps re-seeding safe.

```cypher
CREATE CONSTRAINT talent_id     IF NOT EXISTS FOR (t:Talent)     REQUIRE t.id   IS UNIQUE;
CREATE CONSTRAINT project_id    IF NOT EXISTS FOR (p:Project)    REQUIRE p.id   IS UNIQUE;
CREATE CONSTRAINT agency_id     IF NOT EXISTS FOR (a:Agency)     REQUIRE a.id   IS UNIQUE;
CREATE CONSTRAINT collective_id IF NOT EXISTS FOR (c:Collective) REQUIRE c.id   IS UNIQUE;
CREATE CONSTRAINT skill_id      IF NOT EXISTS FOR (s:Skill)      REQUIRE s.id   IS UNIQUE;
CREATE CONSTRAINT skill_name    IF NOT EXISTS FOR (s:Skill)      REQUIRE s.name IS UNIQUE;

CREATE INDEX talent_name  IF NOT EXISTS FOR (t:Talent)  ON (t.name);
CREATE INDEX project_year IF NOT EXISTS FOR (p:Project) ON (p.year);
```

The uniqueness constraints are what make `MERGE` idempotent: re-running the seed
updates the existing nodes instead of growing a second copy of the graph. Each
one also creates a backing index, which is what keeps the label-scoped lookups
in §3 from degrading into scans.

### 2.3 Identity rule

**Every node carries an `id`, including `Skill`.** This is not redundancy. The
explorer addresses nodes uniformly — "expand this node", "inspect that node" —
and a node type that had to be looked up by a different property would force a
special case into every one of those paths. `Skill.name` stays unique because it
is the semantic key that `MERGE` deduplicates on; `Skill.id` is the addressing
key. Ids are stable slugs (`talent-rian-sutradara`, `skill-cinematography`), so
they survive a re-seed.

Never key application code on `elementId()`. On this instance it returns a bare
counter (`"1"`), not Neo4j's `4:<uuid>:1` form, and it is not stable across a
re-seed.

### 2.4 Dispatching on a label safely

Cypher cannot parameterize a label — `MATCH (n:$label)` is not valid, and
interpolating the label into the query string is exactly the concatenation the
project rules forbid. A label-less `MATCH (n {id: $id})` is valid but scans every
node, because no index can be label-agnostic.

The resolution is a lookup table of complete, pre-written query constants keyed
by a validated label. The label never becomes part of a string operation; it
only selects which fixed query to run, and an unrecognised value is rejected
before any query is chosen:

```ts
const NEIGHBOURHOOD_BY_LABEL = {
  Talent:     'MATCH (n:Talent {id: $nodeId}) ...',
  Project:    'MATCH (n:Project {id: $nodeId}) ...',
  Agency:     'MATCH (n:Agency {id: $nodeId}) ...',
  Collective: 'MATCH (n:Collective {id: $nodeId}) ...',
  Skill:      'MATCH (n:Skill {id: $nodeId}) ...',
} as const;

// `label` arrives from the client, so it is checked against the map's own keys
// before it can select anything. Values stay parameters.
const query = NEIGHBOURHOOD_BY_LABEL[label];
if (!query) throw new BadRequestError(`Unknown node type "${label}".`);
```

---

## 3. Key Cypher Queries

Every query is executed through `readQuery()` in `src/lib/cognodb.ts` with
driver parameters. No value is ever interpolated into the query string.

### Query A: Multi-hop network traversal

Find talents with a given skill who are implicitly connected to a director
through a shared production agency — people you have never worked with, but who
are one introduction away.

Four hops from talent to talent, five relationships in total:
`t1 → p1 → agency ← p2 ← t2 → skill`.

```cypher
MATCH (t1:Talent {id: $talentId})-[:COLLABORATED_ON]->(p1:Project)-[:PRODUCED_BY]->(agency:Agency)
MATCH (agency)<-[:PRODUCED_BY]-(p2:Project)
      <-[c2:COLLABORATED_ON]-(t2:Talent)-[:HAS_SKILL]->(s:Skill {name: $skill})
WHERE t1 <> t2
  AND COUNT { (t1)-[:COLLABORATED_ON]->(:Project)<-[:COLLABORATED_ON]-(t2) } = 0
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
LIMIT 20;
```

The returned `viaAgency` / `yourProject` / `theirProject` triple is what lets the
UI explain *why* someone was recommended instead of just listing them.

#### Why `COUNT { … } = 0`, and not `NOT (t1)-[…]-(t2)`

"People you have never worked with" reads naturally as a negated pattern:

```cypher
-- Correct Cypher. Wrong answers on this instance.
WHERE NOT (t1)-[:COLLABORATED_ON]->(:Project)<-[:COLLABORATED_ON]-(t2)
```

`EXISTS()` over a pattern does not read the graph on CognoDB. Once both
endpoints are bound it answers the same way for every pair, whatever the data
says:

```cypher
MATCH (a:Talent {id: 'talent-rian-syahputra'}), (b:Talent {id: 'talent-sari-wulandari'})
RETURN EXISTS((a)-[:COLLABORATED_ON]->(:Project)<-[:COLLABORATED_ON]-(b)) AS shared
-- => false. A plain MATCH proves this pair shares a project.
--    Swap in a pair that shares nothing: also false.
```

Which constant comes back is not predictable from the query. The same directed
two-hop pattern that is uniformly false across `Talent` above is uniformly *true*
on the probe's own fixture. Written undirected it is true for every pair,
including two nodes with nothing between them, and a single-hop
`EXISTS((a)-[:COLLABORATED_ON]->(b))` with both ends bound is likewise true
regardless. So the failure is not that the predicate is too strict or too loose
— it is that the predicate is a constant that happens to look plausible.

That is what made the bug quiet. Against the seeded graph the constant is
`false`, so a negation of it excludes nobody, and the recommendation list filled
with people the requester had already worked with — including rows where
`yourProject` and `theirProject` were the same production. Nothing errors; the
query just answers a different question.

`COUNT { }` does read the graph, and returns the right answer for both a
sharing pair and a non-sharing one. Substituting it changed no results across
40 talent-and-skill combinations against the seeded graph, and cost nothing
measurable: both spellings ran at 737 ms per query, which is round-trip latency
to the hosted instance rather than query time.

`npm run probe` checks both spellings against a fixture with a sharing pair
*and* a non-sharing pair. Checking only a pair that shares would pass on a
constant `true` and prove nothing — an earlier version of the probe did exactly
that and reported the defect as fixed.

### Query B: Shortest path between two talents

Degrees of separation, allowing the path to cross projects, agencies, or
collectives in any combination and any direction.

```cypher
MATCH (a:Talent {id: $fromId}), (b:Talent {id: $toId})
MATCH path = shortestPath((a)-[*..4]-(b))
RETURN
  length(path)                         AS degrees,
  [n IN nodes(path) | {
    id:    n.id,
    label: head(labels(n)),
    name:  coalesce(n.name, n.title)
  }]                                   AS pathNodes,
  [r IN relationships(path) | type(r)] AS pathTypes;
```

**Why `[*..4]` and not `[*..6]`:** the hop budget is a real cost, not a
formality. On a graph this dense, an unbounded or 6-hop search on the free-tier
instance (0.5 vCPU / 256 MB) expands into a very large frontier before it
terminates. Four hops covers every genuinely meaningful connection here — a
talent and their collaborator's collaborator's collective — and anything beyond
that is not a relationship a person would recognise as one. The query returns no
rows when no path exists within the budget, which the UI renders as an explicit
"no known connection" state rather than an error.

**Talent-to-talent distances are always even.** The schema is bipartite:
`Talent` and `Agency` on one side, `Skill`, `Collective`, and `Project` on the
other, and every relationship in §2 crosses between the two. A path from a
talent therefore alternates sides and can only return to a talent after an even
number of hops. The reachable distances are 2 and 4, never 1, 3, or 5 — which is
why raising the budget to 5 would buy nothing, and why the UI can describe a
result as "one introduction away" (2) or "two introductions away" (4) without
ever having to phrase an odd case.

### Query C: Node neighbourhood

Powers the explorer canvas: expand whatever the user clicked, one hop in every
direction, regardless of relationship type. Shown here for `Talent`; the other
four labels are the same query with the label swapped, selected through the map
in §2.4 rather than by interpolation.

```cypher
MATCH (n:Talent {id: $nodeId})
OPTIONAL MATCH (n)-[r]-(m)
RETURN
  {id: n.id, label: head(labels(n)), name: n.name} AS node,
  collect(DISTINCT CASE WHEN m IS NULL THEN NULL ELSE {
    id:        m.id,
    label:     head(labels(m)),
    name:      coalesce(m.name, m.title),
    type:      type(r),
    role:      r.role,
    direction: CASE WHEN startNode(r) = n THEN 'out' ELSE 'in' END
  } END)                                           AS neighbours;
```

`OPTIONAL MATCH` is what makes an isolated node return a row with an empty
neighbour list rather than nothing at all — the UI can then draw the node and
say it has no connections, instead of showing a spurious "not found".

### Query D: Search

Backs the search bar. Case-insensitive substring matching across the labels a
person would search by.

```cypher
MATCH (n)
WHERE (n:Talent OR n:Project OR n:Agency OR n:Collective OR n:Skill)
  AND toLower(coalesce(n.name, n.title)) CONTAINS toLower($term)
RETURN
  n.id                                              AS id,
  head(labels(n))                                   AS label,
  coalesce(n.name, n.title)                         AS name,
  coalesce(n.role, n.type, n.category, n.focus, '') AS detail
ORDER BY name
LIMIT 15;
```

This one deliberately scans: substring search cannot use a range index, and at
73 nodes the scan is cheaper than maintaining a full-text index. Revisit if
the dataset ever grows past a few thousand nodes, at which point the answer is
`CREATE FULLTEXT INDEX`.

### Query E: Graph overview

The initial canvas payload — the whole graph, which is safe to ship in one
response at this dataset size (73 nodes, 161 relationships) and keeps the first
paint fast.

```cypher
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
}) AS edges;
```
