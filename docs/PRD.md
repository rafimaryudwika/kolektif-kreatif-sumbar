# Product Requirement Document (PRD)

## 1. Executive Summary

* **Project Name**: Sumbar Creative Network (SumbuKolektif)
* **Objective**: A graph-backed web application mapping the organic ecosystem of creative talents, collectives, and production entities in West Sumatra (Filmmakers, Designers, Animators, Musicians, MUA, 3D Visualizers).
* **Tech Stack**: Astro (Fullstack/SSR), CognoDB (OpenCypher via Bolt protocol), Neo4j JavaScript Driver, Vercel.
* **Timeframe**: 48-Hour Engineering Challenge.

## 2. Problem Statement

The regional creative industry relies heavily on organic, word-of-mouth collaboration networks rather than rigid corporate structures. Traditional Relational Database Management Systems (RDBMS) struggle to model deep multi-directional relationships such as:

* *"Which DoP has worked with Director X or was engaged by Agency Y across past projects?"*
* *"What is the shortest path of mutual collaborators connecting Talent A and Talent B?"*

Executing these queries in SQL requires expensive, deeply nested `JOIN` operations that degrade performance and lead to overly complex schemas.

## 3. Core Capabilities & Scope

1. **Graph Network Explorer**: A non-technical UI to visually traverse and search nodes (`Talent`, `Project`, `Agency`, `Skill`) and their directional relationships.
2. **Multi-Hop Collaboration Discovery**: Query engine designed to execute $\ge 2$-hop traversals to recommend crew members based on implicit mutual networks.
3. **Shortest Path Finder**: Calculate degrees of separation between any two entities in the creative ecosystem.

## 4. Evaluation Criteria Alignment

* **Graph Model Soundness**: Typed relationships, labeled nodes, and proper property modeling.
* **Query Safety**: 100% parameterized Cypher queries via the official Neo4j driver (zero string concatenation).
* **UX & Resilience**: Clean loading states, empty fallback states, error boundaries for DB timeouts, and full mobile responsiveness.
