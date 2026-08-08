# Engineering Architecture

## 1. Stack Topology

* **Application tier**: Astro 7 in SSR mode (`output: 'server'`), deployed to
  Vercel through the `@astrojs/vercel` adapter. Interactive islands are Svelte 5.
  The graph canvas is Cytoscape.js with the `fcose` force-directed layout,
  mounted `client:only="svelte"` because that layout touches `window`. The
  landing page's search and entity card (`HomeSearch.svelte`, which owns
  `EntityModal.svelte`) mount `client:load` instead — they render on the server,
  so the search box and its chips are in the first HTML response.
* **Database tier**: CognoDB Cloud, free-tier instance `c0`
  (0.5 vCPU, 256 MB RAM, 1 GB disk, 200 connections), reached over
  `bolt+s://` — Bolt 5.4 against a Neo4j 5.26 server.
* **Driver**: the official `neo4j-driver` for Node.js.

```text
[ Browser — Svelte islands ]
    landing:  search + entity card
    explorer: graph canvas + inspector
            │
            │ fetch() → JSON
            ▼
[ Astro SSR routes (src/pages/api/*) on Vercel Functions ]
            │
            │ parameterized Cypher over Bolt TLS
            ▼
[ CognoDB managed graph instance ]
```

Everything renders per request; no route is prerendered, because every page
depends on live graph data. A static page can still opt out with
`export const prerender = true`.

## 2. Database Connection Lifecycle

All database access goes through the singleton in `src/lib/cognodb.ts`. Nothing
else in the codebase calls `neo4j.driver()`.

* **One driver per process.** A serverless function may handle many requests
  before it is frozen; creating a driver per request would leak sockets and burn
  through the 200-connection ceiling. The driver is created lazily on first use
  and reused thereafter.
* **Managed transactions.** Queries run through `session.executeRead()` /
  `session.executeWrite()`, so the driver handles retries on transient failures.
  Sessions are closed in a `finally` block.
* **Pool sized for the tier.** `maxConnectionPoolSize: 10` with a 10 s
  acquisition timeout, so a burst of concurrent function instances cannot
  exhaust the instance's connection budget.
* **Plain integers.** `disableLosslessIntegers: true` means Cypher integers
  arrive as JavaScript numbers and serialize straight to JSON — no `{low, high}`
  objects leaking into API responses.

### 2.1 Error taxonomy

Failures are sorted into three kinds, because they deserve three different
responses:

| Thrown | Meaning | HTTP |
| --- | --- | --- |
| `DatabaseConfigError` | Environment variables missing — a deployment mistake. | 500 `DATABASE_NOT_CONFIGURED` |
| `DatabaseUnavailableError` | Instance unreachable, auth rejected, or a transient server fault. | 503 `DATABASE_UNAVAILABLE` + `Retry-After: 5` |
| anything else | Our own bug (Cypher syntax, constraint violation). Logged in full, never echoed. | 500 `INTERNAL_ERROR` |

The message on `DatabaseUnavailableError` is deliberately generic. An
authentication failure must not tell a visitor that the password was wrong; the
precise driver code stays on `.code` and the original error on `.cause`, both
server-side only. `src/lib/api.ts` performs this mapping for every API route.

The UI degrades rather than breaking: when the database is unreachable, pages
still return 200 with an explicit "graph database unreachable" state, and
`GET /api/health` returns 503 so an uptime check can see the difference without
parsing a body.

## 3. API Surface

Every route is `GET`, returns `{ data }` on success and `{ error: { code,
message } }` otherwise, and runs exactly one query from `src/lib/graph.ts`.
Input validation and the error mapping in §2.1 are the only logic in a route.

| Route | Query | Parameters | Notes |
| --- | --- | --- | --- |
| `/api/graph` | E | — | Whole graph in one response. |
| `/api/node` | C | `id`, `label` | `label` must be one of the five; see below. |
| `/api/search` | D | `q` | Minimum two characters. |
| `/api/recommendations` | A | `talentId`, `skill` | `skill` is the skill's name. |
| `/api/path` | B | `from`, `to` | Two talent ids. |
| `/api/health` | — | — | 503 when the database is unreachable. |

### 3.1 Empty is an answer, not an error

Three endpoints can legitimately return nothing, and all three answer 200:

* `/api/recommendations` with `recommendations: []` — the talent exists and has
  nobody with that skill in their agency network.
* `/api/path` with `path: null` — no route within the four-hop budget. This is
  the same response a mistyped id produces, which is deliberate: both mean
  there is nothing to draw, and the UI says so either way.
* `/api/graph` with empty arrays — only reachable against an unseeded database,
  where an empty graph is more honest than a 500 that hides the real cause.

`/api/node` is the exception. It answers 404 when the id does not exist, because
the query returns a row even for a node with no connections, so no row can only
mean the node is absent.

### 3.2 Why `/api/node` takes a label

Cypher cannot parameterize a label, and building the query by concatenation is
forbidden here. The resolution is the lookup table in `docs/database.md` §2.4:
five complete queries built at module load from a fixed `as const` array, keyed
by label. A request's label is checked against that list and then only used as a
map key — it never reaches a query string. `neighbourhoodQuery` is unexported
and typed to the five-literal union, so passing a request-supplied `string` to
it fails `astro check` rather than reaching review.

The label is required rather than derived from the id prefix. The seed's slugs
do encode their type, but depending on that would couple every request to the
seed script's naming, and the client already knows the label from whatever
payload handed it the id.

### 3.3 Two callers per route

`/api/search` and `/api/node` each serve two islands. The explorer calls them for
its search box and inspector; the landing page calls the same two for its search
box and entity card. Adding graph traversal to the homepage therefore added no
endpoint and no query — `EntityModal` walks by calling `/api/node` again with the
neighbour the visitor clicked, and keeps the nodes it came from on a stack so the
back button can replay them.

The label `EntityModal` sends is the one that arrived in a previous response,
never a value a visitor typed, so §3.2's allowlist is checking server-issued data
on this path. It is still checked; a client is a client.

### 3.4 The explorer's opening state comes from the URL

`Explorer.svelte` reads the query string once, after `/api/graph` resolves, so
every view the app can show is addressable:

| Parameter | Effect |
| --- | --- |
| `select=<id>` (or `node=<id>`) | Opens the inspector on that node. |
| `tab=detail\|path\|suggest` | Chooses the panel. Anything else is ignored. |
| `from=<id>`, `to=<id>` | Fills the path form; both present traces immediately. |

`select` is resolved against the overview payload already in memory rather than
fetched, so an id that is not in the graph opens nothing instead of erroring. The
Copy Link and Share buttons produce `?select=`, and Find Path produces
`?tab=path&from=`. Both use `navigator.clipboard`, which needs a secure context —
they work on the deployed HTTPS site and on `localhost`, and silently do nothing
if the page is ever served over plain HTTP from another host.

### 3.5 Featured entities are checked by the seed

The landing page offers five one-click nodes, one per type, listed in
`src/lib/featured.ts`. They are hand-picked, so they can drift from the dataset,
and once did: two ids shipped that the seed had never written, and clicking them
opened the entity card on "Unable to load connections". `scripts/seed.ts` now
resolves every id in that list against the graph it just wrote and fails the seed
on a missing node or a mismatched label — the same reasoning that already makes
Queries A and B part of the seed rather than a manual follow-up.

## 4. Environment Variables

Read strictly from the runtime environment and never committed. `.env` is
gitignored; `.env.example` documents the shape.

| Variable | Example |
| --- | --- |
| `COGNODB_URL` | `bolt+s://<instance-id>.databases.cognodb.com` |
| `COGNODB_USERNAME` | `cognodb` |
| `COGNODB_PASSWORD` | *(secret)* |

The same three variables must be set in the Vercel project settings for the
deployed build.

## 5. Operational Scripts

| Command | Purpose |
| --- | --- |
| `npm run probe` | Runs `scripts/probe-cognodb.js` — checks connectivity and confirms the Cypher features this app relies on (`shortestPath`, variable-length paths, constraints, `MERGE` idempotency). Writes only under a `_Probe` label and cleans up after itself, so it is safe against a seeded database. |
| `npm run seed` | Wipes and repopulates the graph with the mock dataset, then runs the app's own Query A and Query B against what it just wrote and resolves the landing page's featured ids. Exits non-zero if any check fails. |
| `npm run check` | `astro check`, then `svelte-check --threshold error`. Both are needed: `astro check` does not read inside `.svelte` files, so on its own it passes a component calling a function it never imported. |
| `npm run build` | Production SSR build through the Vercel adapter. |

## 6. Known Advisory

`npm audit` reports three high-severity findings that all resolve to one root
cause: `@astrojs/vercel@11.0.5` (the current release) pins
`@vercel/routing-utils@5.3.3`, which depends on `path-to-regexp@6.1.0` — subject
to a ReDoS advisory for backtracking regular expressions.

No upstream fix exists yet, and `npm audit fix --force` would downgrade the
adapter and break the build. The exposure here is nil in practice: this package
runs at **build time**, compiling our own route patterns from `astro.config.mjs`
into Vercel's routing manifest. It never sees request-time user input. Revisit
when `@astrojs/vercel` bumps its dependency.
