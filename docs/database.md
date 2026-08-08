# Database Specification & Graph Data Model

## 1. Why a Graph Database?

In a relational database (SQL), querying implicit connections across 3 or 4 levels of collaboration requires joining `talents`, `project_memberships`, `projects`, `agencies`, and `skills` tables multiple times.

```sql
-- Relational Approach (Messy & Slow at Scale)
SELECT DISTINCT t2.name 
FROM talents t1
JOIN project_memberships pm1 ON t1.id = pm1.talent_id
JOIN projects p1 ON pm1.project_id = p1.id
JOIN agencies a ON p1.agency_id = a.id
JOIN projects p2 ON a.id = p2.agency_id
JOIN project_memberships pm2 ON p2.id = pm2.talent_id
JOIN talents t2 ON pm2.talent_id = t2.id
WHERE t1.name = 'Rian Sutradara' AND t2.id != t1.id;

```

**Graph Database Advantage**:

* **Index-Free Adjacency**: Traversal takes $O(1)$ time per hop regardless of total dataset size, whereas relational joins scale at $O(N \log N)$ or worse.
* **Expressive Schema**: Cypher's ASCII-art syntax `()-[]->()` natively expresses intent, making multi-hop graph patterns clean and maintainable.

## 2. Schema Definition

### Nodes & Labels

* `Talent`: `{ id: String, name: String, location: String }`
* `Skill`: `{ name: String, category: String }`
* `Project`: `{ id: String, title: String, year: Integer, type: String }`
* `Agency`: `{ id: String, name: String, type: String }`
* `Collective`: `{ id: String, name: String, city: String }`

### Typed Relationships

* `(:Talent)-[:HAS_SKILL]->(:Skill)`
* `(:Talent)-[:MEMBER_OF]->(:Collective)`
* `(:Talent)-[:COLLABORATED_ON { role: String }]->(:Project)`
* `(:Project)-[:PRODUCED_BY]->(:Agency)`

---

## 3. Key Cypher Queries

### Query A: Multi-Hop Network Traversal ($\ge 2$ Hops)

Find 3D Visualizers / Animators implicitly connected to a specific Director via shared Production Agencies.

```cypher
MATCH (t1:Talent {name: $directorName})-[:COLLABORATED_ON]->(p1:Project)-[:PRODUCED_BY]->(agency:Agency)
MATCH (agency)<-[:PRODUCED_BY]-(p2:Project)<-[:COLLABORATED_ON]-(t2:Talent)-[:HAS_SKILL]->(s:Skill {name: $targetSkill})
WHERE t1 <> t2
RETURN DISTINCT t2.id AS talentId, t2.name AS talentName, s.name AS skill, agency.name AS connectedAgency
LIMIT 10;

```

### Query B: Shortest Path Traversal

Find the degree of separation between two creative talents.

```cypher
MATCH (t1:Talent {id: $talentIdA}), (t2:Talent {id: $talentIdB})
MATCH p = shortestPath((t1)-[*..6]-(t2))
RETURN p;

```
