# Product Requirement Document (PRD)

## 1. Executive Summary

* **Project Name**: Sumbar Creative Network (SumbuKolektif)
* **Objective**: A graph-backed web application mapping the organic ecosystem of creative talents, collectives, and production entities in West Sumatra (Filmmakers, Designers, Animators, Musicians, MUA, 3D Visualizers).
* **Tech Stack**: Astro 7 (SSR) + Svelte 5 islands, CognoDB (openCypher over Bolt), official `neo4j-driver`, Tailwind CSS v4, Vercel.
* **Timeframe**: 48-Hour Engineering Challenge.

## 2. Problem Statement

The regional creative industry relies heavily on organic, word-of-mouth collaboration networks rather than rigid corporate structures. Traditional Relational Database Management Systems (RDBMS) struggle to model deep multi-directional relationships such as:

* *"Which DoP has worked with Director X or was engaged by Agency Y across past projects?"*
* *"What is the shortest path of mutual collaborators connecting Talent A and Talent B?"*

Executing these queries in SQL requires expensive, deeply nested `JOIN` operations that degrade performance and lead to overly complex schemas.

## 3. Core Capabilities & Scope

1. **Graph Network Explorer**: A non-technical UI to visually traverse and search nodes (`Talent`, `Project`, `Agency`, `Collective`, `Skill`) and their directional relationships.
2. **Multi-Hop Collaboration Discovery**: Query engine designed to execute $\ge 2$-hop traversals to recommend crew members based on implicit mutual networks. The shipped query is 4 hops talent-to-talent.
3. **Shortest Path Finder**: Calculate degrees of separation between any two talents, and show the path that produced the answer — including routes through shared collectives that no project-based query would find.

## 4. Evaluation Criteria Alignment

* **Graph Model Soundness**: Typed relationships, labeled nodes, and proper property modeling.
* **Query Safety**: 100% parameterized Cypher queries via the official Neo4j driver (zero string concatenation).
* **UX & Resilience**: Clean loading states, empty fallback states, error boundaries for DB timeouts, and full mobile responsiveness. The stacked narrow-width layout is captured at 390px in `docs/screenshots/06-mobile.png`; the unreachable-database and empty-graph states were walked with the network layer stubbed, and both leave search working and hide the panels that cannot answer.

## 5. Submission Deliverables

Taken from the assignment brief in `docs/take-home-test-assignment.pdf`. All four
are required; the last two are the ones easiest to forget until the deadline.

| Deliverable | Status |
| --- | --- |
| Public GitHub repository | done — [rafimaryudwika/kolektif-kreatif-sumbar](https://github.com/rafimaryudwika/kolektif-kreatif-sumbar) |
| README: use case, *why a graph database*, data model diagram, setup steps, queries explained, UI screenshots | done — `README.md`, screenshots in `docs/screenshots/` |
| Hosted demo link (Vercel) | pending — the three `COGNODB_*` variables go into the project settings |
| Short screen recording of the working app | pending — blocked on the hosted demo |

The repository is already public, so its history was audited before this was
recorded: `.env` appears in no commit on any branch, `.env.example` is the only
env file ever committed, and `COGNODB_PASSWORD=` has been empty in every
revision of it. No credential to rotate.

Non-negotiables the brief calls out explicitly, all of which are already in
place at the library layer:

* At least one traversal of two hops or more. — Query A, 4 hops.
* At least one query that would be awkward in an RDBMS. — Query B; the SQL
  equivalent is a hand-rolled recursive CTE with its own cycle guard.
* Parameterized queries throughout.
* Connection details from environment variables, never committed.
* Graceful handling when the database is unreachable.

The CognoDB instance must stay running until Wexa AI responds to the submission.
Submit to `hr@wexa.ai` with the subject `CognoDB Assignment 2 – <Your Name>`.
