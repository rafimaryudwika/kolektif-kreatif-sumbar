# Design System & UI/UX Principles

## 1. Visual Hierarchy & Layout

* **Typography**: Inter, self-hosted through Astro's font API
  (`fontProviders.fontsource()`) so first paint never waits on a third-party
  CDN. Exposed as `--font-inter`, wired to Tailwind's `font-sans`.
* **Theme**: dark, zinc-based. The canvas stays near-black so the node colours
  below are the only saturated things on screen.

All tokens live in `src/styles/global.css` as a Tailwind v4 `@theme` block, so
every colour below is usable as a utility (`bg-talent`, `text-ink-muted`) and as
a CSS variable (`var(--color-talent)`) from the graph renderer.

## 2. Colour Tokens

### Node colours

| Entity | Token | Hex |
| --- | --- | --- |
| `Talent` | `--color-talent` | `#3B82F6` (blue) |
| `Project` | `--color-project` | `#10B981` (green) |
| `Agency` | `--color-agency` | `#F59E0B` (amber) |
| `Skill` | `--color-skill` | `#EC4899` (pink) |
| `Collective` | `--color-collective` | `#8B5CF6` (violet) |

Violet was chosen for `Collective` because it is the only remaining hue with
clear separation from the other four at small node sizes, and it reads as
distinct from `Talent` blue even for the common forms of colour-vision
deficiency. Colour is never the sole carrier of meaning: every node also has a
text label, and the inspector states the entity type in words.

### Surfaces & ink

| Token | Hex | Use |
| --- | --- | --- |
| `--color-canvas` | `#09090B` | Page background, graph canvas |
| `--color-surface` | `#131316` | Cards, panels |
| `--color-surface-raised` | `#1C1C21` | Inspector, popovers, hover |
| `--color-border` | `#27272A` | Default hairlines |
| `--color-border-strong` | `#3F3F46` | Focused / selected edges |
| `--color-ink` | `#FAFAFA` | Primary text |
| `--color-ink-muted` | `#A1A1AA` | Secondary text |
| `--color-ink-subtle` | `#71717A` | Labels, metadata |

## 3. Interactive States

* **Loading**: skeleton blocks for card and list requests; a centred spinner
  over the canvas while the graph lays out. Never a blank screen.
* **Empty**: an explicit sentence about what was searched and what to try next
  — "No path within 4 hops between A and B" beats an empty canvas.
* **Error**: a non-blocking banner. Database problems say the graph is
  temporarily unreachable and offer a retry; they never surface driver codes,
  query text, or anything about credentials.
* **Selected node**: raise to `--color-surface-raised`, outline in the node's
  own colour, dim unconnected nodes rather than hiding them so the user keeps
  their spatial bearings.

## 4. Accessibility

* Visible `:focus-visible` outline on every interactive element; the graph
  canvas is reachable by keyboard and exposes its selection as text.
* A skip-to-content link precedes the layout.
* `prefers-reduced-motion: reduce` cuts transition and animation durations to
  near zero, including the graph's physics settling animation.
* Body copy meets WCAG AA against `--color-canvas`; `--color-ink-subtle` is
  reserved for text at or above 14 px that is not the only source of the
  information.

## 5. Responsiveness

The explorer is the hard case. Below `md`, the inspector becomes a bottom sheet
instead of a side panel, and the search and filter controls collapse into a
single sticky bar so the canvas keeps most of the viewport.
