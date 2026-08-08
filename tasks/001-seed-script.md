# Task 001: Database Seed Script

## Description

Develop a standalone executable Node.js script (`scripts/seed.js`) that wipes existing data and populates CognoDB with realistic data representing West Sumatra's creative ecosystem[cite: 1].

## Requirements

1. Import `neo4j-driver` and load credentials safely via `dotenv`[cite: 1].
2. Execute a database clean-up query:

```cypher
   MATCH (n) DETACH DELETE n;
```

3. Inject structured mock dataset maintaining realistic scale (~200 nodes):

* 30 `Talent` nodes (Directors, DoPs, Animators, Sound Designers, MUAs, 3D Artists)
* 10 `Skill` nodes
* 20 `Project` nodes
* 6 `Agency` / Production House nodes
* 5 `Collective` nodes

4. Connect typed relationships using `MERGE` statements to guarantee idempotency.


5. Gracefully close the driver upon script completion.
