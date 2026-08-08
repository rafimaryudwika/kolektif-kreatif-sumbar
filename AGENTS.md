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

### Build & Type Checking

Verify types and test the SSR build before committing:

```bash
astro check
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
3. **Environment Security**: Verify `COGNODB_URI`, `COGNODB_USER`, and `COGNODB_PASSWORD` exist in `.env` before executing database commands. Never hardcode credentials.

### Component & Interactive States

* Graph visualizers (e.g., `vis-network` or `cytoscape`) must run purely on the client using Astro's `client:only` or `client:load` directives.
* All API routes under `src/pages/api/` must return structured JSON and handle connection errors gracefully.

---

## Project Documentation

### Internal Documentation

Consult these specs before implementing features or modifying schema:

* [PRD & Capabilities](https://www.google.com/search?q=docs/PRD.md)
* [Database Schema & Cypher Queries](https://www.google.com/search?q=docs/database.md)
* [System Architecture](https://www.google.com/search?q=docs/architecture.md)
* [Design System & UI Guidelines](https://www.google.com/search?q=docs/design-system.md)

### Astro Framework Guides

* [Adding pages, dynamic routes, or API endpoints](https://docs.astro.build/en/guides/routing/)
* [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
* [Using React, Vue, Svelte, or UI framework components](https://docs.astro.build/en/guides/framework-components/)
* [Styling & Tailwind CSS integration](https://docs.astro.build/en/guides/styling/)
* [Deploying to Vercel](https://docs.astro.build/en/guides/deploy/vercel/)
