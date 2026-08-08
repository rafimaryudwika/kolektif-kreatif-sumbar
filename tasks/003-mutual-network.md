# Task 003: Multi-Hop Recommendation Engine

## Description

API endpoint and UI widget for the multi-hop traversal that answers "who should
I be working with that I haven't met?".

## Requirements

1. **API route**: `GET /api/recommendations?talentId=...&skill=...`
   Both parameters required — missing ones return 400 via `requireParam()`.
2. **Query**: Query A from `docs/database.md`, passed as driver parameters.
   It is a **4-hop talent-to-talent traversal** (5 relationships including the
   skill filter): `t1 → project → agency → project → t2 → skill`. This is the
   query the assignment's ">= 2 hops" requirement is satisfied by, and the one
   whose SQL equivalent needs eight joins.
3. **UI**: recommended talent cards, each showing the connection path in words —
   "Connected through **Agency X**: you on *Project Y*, them on *Project Z*".
   The explanation is the point; a bare list of names does not demonstrate the
   traversal.
4. **States**: skeleton while loading; explicit empty state naming the talent and
   skill that were searched; non-blocking banner on 503 that offers a retry.
