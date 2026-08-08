# Engineering Architecture

## 1. Stack Topology

* **Application tier**: Astro 7 in SSR mode (`output: 'server'`), deployed to
  Vercel through the `@astrojs/vercel` adapter. Interactive islands are Svelte 5;
  the graph canvas is Cytoscape.js with the `fcose` force-directed layout,
  mounted `client:only="svelte"`.
* **Database tier**: CognoDB Cloud, free-tier instance `c0`
  (0.5 vCPU, 256 MB RAM, 1 GB disk, 200 connections), reached over
  `bolt+s://` — Bolt 5.4 against a Neo4j 5.26 server.
* **Driver**: the official `neo4j-driver` for Node.js.

```text
[ Browser — Svelte island: graph canvas + inspector ]
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

## 3. Environment Variables

Read strictly from the runtime environment and never committed. `.env` is
gitignored; `.env.example` documents the shape.

| Variable | Example |
| --- | --- |
| `COGNODB_URL` | `bolt+s://<instance-id>.databases.cognodb.com` |
| `COGNODB_USERNAME` | `cognodb` |
| `COGNODB_PASSWORD` | *(secret)* |

The same three variables must be set in the Vercel project settings for the
deployed build.

## 4. Operational Scripts

| Command | Purpose |
| --- | --- |
| `npm run probe` | Runs `scripts/probe-cognodb.js` — checks connectivity and confirms the Cypher features this app relies on (`shortestPath`, variable-length paths, constraints, `MERGE` idempotency). Writes only under a `_Probe` label and cleans up after itself, so it is safe against a seeded database. |
| `npm run seed` | Wipes and repopulates the graph with the mock dataset. |
| `npm run check` | `astro check` — type checking across `.astro`, `.ts`, `.svelte`. |
| `npm run build` | Production SSR build through the Vercel adapter. |

## 5. Known Advisory

`npm audit` reports three high-severity findings that all resolve to one root
cause: `@astrojs/vercel@11.0.5` (the current release) pins
`@vercel/routing-utils@5.3.3`, which depends on `path-to-regexp@6.1.0` — subject
to a ReDoS advisory for backtracking regular expressions.

No upstream fix exists yet, and `npm audit fix --force` would downgrade the
adapter and break the build. The exposure here is nil in practice: this package
runs at **build time**, compiling our own route patterns from `astro.config.mjs`
into Vercel's routing manifest. It never sees request-time user input. Revisit
when `@astrojs/vercel` bumps its dependency.
