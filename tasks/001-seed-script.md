# Task 001: Database Seed Script

## Description

Standalone Node.js script (`scripts/seed.js`) that wipes the graph and
repopulates it with a plausible slice of West Sumatra's creative ecosystem.

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
   the fallback if `CALL { } IN TRANSACTIONS` is rejected.
3. Apply the constraints and indexes from `docs/database.md` §2.2 before
   inserting. The uniqueness constraints are what make step 5 idempotent.
4. Insert roughly 200 nodes:

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
   * Query B finds a 3–4 hop path between two talents whose shortest route runs
     through a `Collective`, not a project. That path is the strongest evidence
     for the graph-database argument, so it must exist in the data.
   * No `Talent` is fully isolated.
7. Close the driver in a `finally` block and print a summary count per label.
