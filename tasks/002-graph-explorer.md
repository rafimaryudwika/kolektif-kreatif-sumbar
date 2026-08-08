# Task 002: Interactive Graph Explorer Interface

## Description

The primary interface: browse, filter, and inspect the graph without knowing
what Cypher is.

## Key Features

1. **Search bar**: backed by Query D. Matches across `Talent`, `Project`,
   `Agency`, `Collective`, and `Skill`; selecting a result focuses that node on
   the canvas.
2. **Filters**: toggle entity types on and off, and filter talents by `location`
   and `role`. Filtering hides nodes on the client from the already-loaded
   graph — no round trip per toggle at this dataset size.
3. **Graph canvas**: a client-side renderer mounted with `client:only="svelte"`,
   since the layout engine touches `window`. Initial payload comes from Query E;
   clicking a node expands its neighbourhood via Query C. Node colours come from
   the `--color-<label>` tokens in `docs/design-system.md`.
4. **Inspector**: slide-over panel (bottom sheet under `md`) showing the selected
   node's properties — talent `role`/`location`/`bio`, project `year`/`type`,
   plus its relationships grouped by type, each clickable to jump.
5. **Path overlay**: when the shortest-path finder returns a result, highlight
   the path edges and dim everything else rather than filtering it away, so the
   user keeps their bearings.

## States

Skeleton while the first graph payload loads; spinner over the canvas while the
layout settles; explicit empty state when a search or filter combination leaves
nothing; non-blocking banner on a 503 with a retry that refetches.
