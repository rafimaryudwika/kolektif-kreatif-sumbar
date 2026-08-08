# Demo recording script

Six beats, about two and a half minutes. Every quoted string below was read off
the hosted deployment, so if a beat says something different on the take, the
data changed and the take should stop.

**Before recording.** Load <https://kolektif-kreatif-sumbar.vercel.app> once and
let the explorer finish, so the Vercel function is warm. Cold, the first
`/api/graph` answers in about 1.1 s; warm it is 0.67 s. Record at 1440×900 or
wider, because narrower widths stack the canvas above the inspector and the demo
reads better side by side.

---

## 1. The landing page (~15 s)

Open `/`. The badge says **Connected to CognoDB**, with `Neo4j/5.26.0 over Bolt
5.4.` under it.

> This is a live check, not a build-time string. Every request asks the database
> whether it is there.

Point at the four node-type counts, then click through to the explorer.

## 2. The graph (~20 s)

`/explore` paints **Laying out the network…** first, then the canvas resolves.

> 73 nodes and 161 relationships: 30 people, 20 productions, 12 skills, 6
> agencies, 5 collectives. Colour is the node type. The layout is force-directed,
> so clusters are agencies and collectives that actually share people.

Let it settle. Do not narrate over the layout animation; it is short.

## 3. Search and inspect (~25 s)

Type `rian` in the search box. One hit. Click it.

The inspector opens on **Rian Syahputra** with `SKILLS (2)` Directing and
Screenwriting, `MEMBER OF (1)` Kolektif Layar Tancap, and `WORKED ON (3)` — Anak
Rantau, Jejak di Ngarai and Lagu untuk Bundo, all as Director.

> The role sits on the relationship, not on the person. Rian is Director on these
> three, and could be something else on a fourth.

Click one of the neighbours to show that traversal keeps going.

## 4. Degrees of separation (~35 s)

Path tab. **Rian Syahputra** to **Wulan Safitri**. Trace the connection.

> 2 introductions away, 4 hops through the network.

Read the chain off the screen:

    Rian Syahputra → has the skill → Screenwriting → also held by →
    Reza Fadillah → worked on → Festival Tabuik → was also crewed by →
    Wulan Safitri

> One `shortestPath` call returns that whole chain as a value. In SQL this is a
> recursive CTE with a visited-set you maintain yourself, and it still hands back
> only the number, not the route.

## 5. The hop no relational query would find (~25 s)

Same tab. **Yusra Hakim** to **Elok Permata**.

> one introduction away, 2 hops through the network.
>
> Yusra Hakim → is a member of → Tiga Tungku → also counts → Elok Permata

> These two share no project, no skill and no agency. They are one introduction
> apart through a collective. A schema built around productions would call them
> unconnected, and that is the answer a producer most needs.

This is the beat that makes the case for the graph. Do not rush it.

## 6. Recommendation, and its explanation (~30 s)

Suggest tab. **Rian Syahputra**, skill **Cinematography**.

> 1 person with Cinematography, reachable through shared agencies.
>
> Tia Rahmadani — Director of Photography
> Both worked for Batang Arau Media — you on Lagu untuk Bundo, them on Suara
> Pasar Raya as Director of Photography.

> Four hops out and back: Rian's productions, the agencies that made them, the
> other productions from those agencies, the people who crewed those. The query
> also excludes anyone Rian has already shared a project with, because the point
> is names he does not already have. And it returns the agency and both
> productions, so the recommendation can say why.

Optional closer, if the recording has room: switch to **Bimo Arya**, who holds no
credits.

> Bimo Arya has no project credits yet, and this suggestion works by walking out
> from them — shared agency first, then who else that agency has hired. Pick
> someone with credits to see it work.

> An empty result is an answer here, not an error, and it says which link is
> missing.

---

## Do not show

- The database-unreachable state. It works, and it is described in the README,
  but faking an outage on camera costs 30 s and reads as filler.
- The mobile layout. The 390 px screenshot is already in the README.
