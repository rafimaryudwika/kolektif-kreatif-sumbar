# Engineering Architecture

## 1. Stack Topology

* **Frontend/Application Tier**: Astro v4+ (Server-Side Rendering mode) hosted on Vercel[cite: 1].
* **Database Tier**: CognoDB Cloud (Free Tier Instance `c0`, Bolt 5.0+ protocol over `bolt+s://`)[cite: 1].
* **Database Driver**: Official `neo4j-driver` for Node.js[cite: 1].

```text
[ Web Browser / Client UI ]
            │
            │ HTTP / JSON API
            ▼
[ Astro Serverless Endpoints (`src/pages/api/*`) ]
            │
            │ Parameterized Cypher via Bolt TCP (`bolt+s://`)
            ▼
[ CognoDB Managed Graph Instance ]

```

## 2. Database Connection Lifecycle

To prevent connection leaks inside Vercel's serverless environment:

* Driver instances are managed as a singleton pattern (`src/lib/cognodb.ts`).
* Queries execute within auto-managed sessions (`session.executeRead()` / `session.executeWrite()`).
* Graceful error boundaries fall back to structured JSON error objects if CognoDB becomes unreachable or hits the 200-connection limit.

## 3. Environment Variables Strategy

All secret connection parameters are read strictly from runtime environment variables and excluded from source control:

* `COGNODB_URI` (`bolt+s://<instance-id>.databases.cognodb.cloud`)

* `COGNODB_USER` (`cognodb`)

* `COGNODB_PASSWORD`
