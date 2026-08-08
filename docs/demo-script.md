# Demo recording script

Seven beats, about three minutes. Every quoted string below was read off the
running app, so if a beat says something different on the take, the data changed
and the take should stop.

**Before recording.** Load <https://kolektif-kreatif-sumbar.vercel.app> once and
let the explorer finish, so the Vercel function is warm. Cold, the first
`/api/graph` answers in about 1.1 s; warm it is 0.67 s. Record at 1440×900 or
wider, because narrower widths stack the canvas above the inspector and the demo
reads better side by side.

---

## 1. The landing page (~15 s)

Open `/`. The header badge says **CognoDB Connected**; the footer says `CognoDB
Neo4j/5.26.0`.

> This is a live check, not a build-time string. Every request asks the database
> whether it is there.

Point at the three cards — **Collaborator Referrals**, **Degrees of Separation**,
**Ecosystem Canvas Map** — then stay on the page.

## 2. Answering from the homepage (~30 s)

Type `ngarai` into the search box. Two hits appear while typing:

    Jejak di Ngarai   Film              Project
    Ngarai Pictures   Production House  Agency

> One query across all five node types, debounced, 200 ms after the last
> keystroke.

Clear it and click the **Rian Syahputra** chip instead.

> Five chips, one per node type, for a visitor who does not have a name to type.

The card opens: `SKILLS (2)` Directing and Screenwriting, `MEMBER OF (1)`
Kolektif Layar Tancap, `WORKED ON (3)` — Jejak di Ngarai, Anak Rantau and Lagu
untuk Bundo, all as Director.

> The role sits on the relationship, not on the person. Rian is Director on these
> three, and could be something else on a fourth.

Click **Kolektif Layar Tancap** inside the card. It reloads in place to
`MEMBERS (5)`: Rian Syahputra, Bayu Pratama, Sari Wulandari, Doni Saputra, Reza
Fadillah. A back arrow appears in the header.

> Traversal without leaving the front page and without loading the canvas. Same
> endpoint the explorer uses — `/api/node`, one node and its neighbours.

Press the back arrow once to show the stack, then **Explore Canvas**.

## 3. The graph (~20 s)

`/explore` paints **Laying out the network…** first, then the canvas resolves.

> 73 nodes and 161 relationships: 30 people, 20 productions, 12 skills, 6
> agencies, 5 collectives. Colour is the node type. The layout is force-directed,
> so clusters are agencies and collectives that actually share people.

Let it settle. Do not narrate over the layout animation; it is short.

## 4. Search and inspect (~20 s)

Type `rian` in the explorer's own search box. One hit. Click it.

The inspector opens on **Rian Syahputra** with the same skills, collective and
three credits, and a **Share 🔗** button next to Close.

> Share copies `/explore?select=talent-rian-syahputra`. Every node in this app has
> a URL, so a result can be sent to someone instead of described.

Click one of the neighbours to show that traversal keeps going.

## 5. Degrees of separation (~35 s)

Path tab. **Rian Syahputra** to **Wulan Safitri**. Trace the connection.

> 2 introductions away, 4 hops through the network.

Read the chain off the screen:

    Rian Syahputra → has the skill → Screenwriting → also held by →
    Reza Fadillah → worked on → Festival Tabuik → was also crewed by →
    Wulan Safitri

> One `shortestPath` call returns that whole chain as a value. In SQL this is a
> recursive CTE with a visited-set you maintain yourself, and it still hands back
> only the number, not the route.

## 6. The hop no relational query would find (~25 s)

Same tab. **Yusra Hakim** to **Elok Permata**.

> one introduction away, 2 hops through the network.
>
> Yusra Hakim → is a member of → Tiga Tungku → also counts → Elok Permata

> These two share no project, no skill and no agency. They are one introduction
> apart through a collective. A schema built around productions would call them
> unconnected, and that is the answer a producer most needs.

This is the beat that makes the case for the graph. Do not rush it.

## 7. Recommendation, and its explanation (~30 s)

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
- A search that matches nothing. `zzzz` returns "No entities match “zzzz”" with
  three suggested terms, which is correct and dull. Beat 2 is more convincing.
