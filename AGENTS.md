# Repository Guidelines & Context

This repository hosts **SumbuKolektif** (Sumbar Creative Network), a graph-backed web application mapping the creative talent ecosystem in West Sumatra, built for the Wexa AI take-home assignment.

## Development Workflow

### Dev Server Commands

When starting the Astro dev server in background mode:

```bash
astro dev --background

```

Manage the background server with:

* `astro dev stop`
* `astro dev status`
* `astro dev logs`

### Database Seeding

To populate or reset the CognoDB graph instance with mock data:

```bash
npm run seed
# or: node scripts/seed.js

```

### Connectivity Probe

Before blaming the app, confirm the database itself is reachable and still
supports the Cypher features we rely on:

```bash
npm run probe
```

Writes only under a `_Probe` label and deletes them again, so it is safe to run
against a seeded instance.

### Build & Type Checking

Verify types and test the SSR build before committing:

```bash
npm run check   # astro check
npm run build

```

---

## Technical Standards & Constraints

### Stack Topology

* **Framework**: Astro (SSR Mode with Vercel Adapter)
* **Database Layer**: CognoDB Cloud (OpenCypher via Bolt protocol using official `neo4j-driver`)
* **Deployment Target**: Vercel Serverless Functions

### Critical Database Rules

1. **Strictly Parameterized Queries**: ALWAYS parameterize Cypher queries using driver variables (e.g., `{ name: $directorName }`). NEVER use string concatenation or template literals for Cypher values.
2. **Singleton Driver Pattern**: Import the DB client from `src/lib/cognodb.ts`. Do not instantiate multiple `neo4j.driver` instances across API routes to prevent socket leaks in serverless environments.
3. **Environment Security**: Verify `COGNODB_URL`, `COGNODB_USERNAME`, and `COGNODB_PASSWORD` exist in `.env` before executing database commands. Never hardcode credentials. `.env` is gitignored; `.env.example` documents the expected keys.
4. **Never key on `elementId()`**: this instance returns a bare counter, not Neo4j's `4:<uuid>:1` form, and it is unstable across a re-seed. Use our own `id` property (or `name` for `Skill`).

### Component & Interactive States

* The graph canvas uses **Cytoscape.js** (`cytoscape` + `cytoscape-fcose` for the force-directed layout) inside a Svelte island mounted with `client:only="svelte"` — the layout engine touches `window`, so it must never run during SSR. Call `cy.destroy()` on unmount.
* All API routes under `src/pages/api/` must return structured JSON and handle connection errors gracefully. Use the helpers in `src/lib/api.ts` (`jsonOk`, `toErrorResponse`, `requireParam`) rather than hand-rolling responses.

---

## Agent Skills

Six skills are installed under `.agents/skills/`, symlinked into `.claude/skills/`
and pinned by hash in `skills-lock.json`. Only some of them apply here, and two
contradict this repo's own specs. That resolution is below.

### When to use which

| Skill | Use it for | Status |
| --- | --- | --- |
| `deslopify` | Every piece of prose that ships: `README.md`, `docs/*.md`, UI microcopy. The README is a graded deliverable. | Required before the README is committed. |
| `last-20-percent` | The explorer's first-run state, empty results, the "no path found" case, and the walkthrough before recording the demo. | Required before calling the app done. |
| `interface-kit` | Accessibility, motion, and review checklists while building the graph canvas and inspector. | Use, but subordinate to `docs/design-system.md`. |
| `grill-me` | User-invoked only (`/grill-me`). Pressure-test the README's "why a graph database" argument the way a reviewer would. | Optional gate before submission. |
| `domain-modeling` | The discipline only: challenge a fuzzy term, cross-check the docs against the code. | Do not create `CONTEXT.md` or `docs/adr/`. |
| `caveman` | Nothing in this repo. It is a session-level output style, not a project convention. | Never affects code, commits, or docs. |

### `docs/design-system.md` is this repo's DESIGN.md

`interface-kit` defers to a root `DESIGN.md` and falls back to its own defaults
when none exists. Our design system lives at `docs/design-system.md`, so that
fallback would fire by mistake. It must not: **`docs/design-system.md` overrides
`interface-kit` wherever they disagree.** Three known disagreements:

1. The skill's ban list rejects Inter as a display font. We use Inter, chosen
   and self-hosted deliberately. Ours wins.
2. The skill prescribes HSL custom properties in the shadcn pattern. We use
   Tailwind v4 `@theme` tokens in hex, already committed in
   `src/styles/global.css`. Ours wins.
3. `references/component-patterns.md` is written for React, Next.js, shadcn,
   CVA, and React Hook Form — none of which are in this stack. Skip that file.
   `accessibility-checklist.md`, `animation-playbook.md`, and
   `review-checklist.md` are stack-agnostic and do apply.

### No second home for the domain model

`domain-modeling` proposes a root `CONTEXT.md` glossary and a `docs/adr/`
directory. This repo already carries both, in place: the entity glossary is
`docs/database.md` §2, and each significant decision is recorded next to the
thing it governs — the hop budget in §3 Query B, label dispatch in §2.4, the
`elementId()` rule in §2.3, Cytoscape in this file. Duplicating them into new
files produces two copies that drift. Apply the skill's discipline, then write
the result into the existing docs.

---

## Project Documentation

### Internal Documentation

Consult these specs before implementing features or modifying schema:

* [PRD & Capabilities](docs/PRD.md)
* [Database Schema & Cypher Queries](docs/database.md)
* [System Architecture](docs/architecture.md)
* [Design System & UI Guidelines](docs/design-system.md)

### Astro Framework Guides

* [Adding pages, dynamic routes, or API endpoints](https://docs.astro.build/en/guides/routing/)
* [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
* [Using React, Vue, Svelte, or UI framework components](https://docs.astro.build/en/guides/framework-components/)
* [Styling & Tailwind CSS integration](https://docs.astro.build/en/guides/styling/)
* [Deploying to Vercel](https://docs.astro.build/en/guides/deploy/vercel/)
