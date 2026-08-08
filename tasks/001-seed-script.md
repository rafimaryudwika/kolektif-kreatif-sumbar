# Task 001: Database Seed Script

## Description

Standalone script (`scripts/seed.ts`) that wipes the graph and repopulates it
with a plausible slice of West Sumatra's creative ecosystem. TypeScript, run
under Node's type stripping, so it can import the singleton in
`src/lib/cognodb.ts` directly instead of duplicating the connection logic.

## Requirements

1. Load credentials via `dotenv/config`; use the singleton in
   `src/lib/cognodb.ts` rather than a fresh `neo4j.driver()`. Exit non-zero with
   a clear message if `COGNODB_URL` / `COGNODB_USERNAME` / `COGNODB_PASSWORD`
   are missing.
2. Wipe first, in batches so the free-tier instance (256 MB) is not asked to
   hold the whole delete in one transaction:

   ```cypher
   MATCH (n) CALL { WITH n DETACH DELETE n } IN TRANSACTIONS OF 500 ROWS;
   ```

   A plain `MATCH (n) DETACH DELETE n` is acceptable at this dataset size and is
   the fallback if `CALL { } IN TRANSACTIONS` is rejected. **CognoDB does reject
   it** — `Neo.ClientError.Statement.SyntaxError: unexpected token IN`, in an
   autocommit transaction or otherwise — so the fallback is what ships. The
   probe script records this.
3. Apply the constraints and indexes from `docs/database.md` §2.2 before
   inserting. The uniqueness constraints are what make step 5 idempotent.
4. Insert 73 nodes:

   | Label | Count | Notes |
   | --- | --- | --- |
   | `Talent` | 30 | Directors, DoPs, Animators, Sound Designers, MUAs, 3D Artists. Needs `id`, `name`, `role`, `location`, `bio`. |
   | `Skill` | 12 | Needs both `id` and `name` — see database spec §2.3. Grouped by `category`. |
   | `Project` | 20 | Mixed `type` and `year`. |
   | `Agency` | 6 | Production houses across Padang, Bukittinggi, Payakumbuh. |
   | `Collective` | 5 | Informal groups — see §2.1 of the database spec. |

   Ids are stable slugs (`talent-rian-sutradara`, `skill-cinematography`) so they
   survive a re-seed and can be pasted into a URL.

5. Write relationships with `UNWIND` + `MERGE` so re-running the script converges
   instead of duplicating. `COLLABORATED_ON` carries `role`.
6. **Shape the data so the demo queries return something.** This is a
   requirement, not a nicety — verify after seeding that:
   * Query A returns at least one recommendation for at least one talent/skill
     pair, routed through a shared agency.
   * Query B finds a path between two talents whose shortest route runs through
     a `Collective`, not a project. That path is the strongest evidence for the
     graph-database argument, so it must exist in the data. Verify one at 2 hops
     and one at 4.

     Hop counts here are always **even**. The schema is bipartite — `Talent` and
     `Agency` on one side, `Skill`, `Collective`, and `Project` on the other,
     with every edge crossing between the two — so a talent-to-talent path
     alternates sides and can only close on an even number of hops. An earlier
     draft of this task asked for 3 hops, which the schema makes impossible.
   * No `Talent` is fully isolated.
7. Close the driver in a `finally` block and print a summary count per label.
