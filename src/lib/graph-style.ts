/**
 * Cytoscape presentation: the stylesheet, the layout options, and the one place
 * that reads design tokens out of CSS.
 *
 * Cytoscape paints to a canvas, so it cannot resolve `var(--color-talent)` the
 * way a DOM node can — it needs a literal colour. Rather than repeat the hex
 * codes from `docs/design-system.md` §2 here, the values are read off the
 * document at mount, which keeps `src/styles/global.css` the single source of
 * truth the file says it is. Browser-only by construction: it touches
 * `document` and `matchMedia`, so it is imported from the island alone.
 */

import type { StylesheetStyle } from 'cytoscape';
import type { FcoseLayoutOptions } from 'cytoscape-fcose';
import { NODE_LABELS } from './graph';

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * `docs/design-system.md` §4: the physics settling animation is exactly the
 * kind of motion this setting exists to suppress. The CSS override in
 * `global.css` cannot reach a canvas, so the layout has to ask directly.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function graphStylesheet(): StylesheetStyle[] {
  const ink = token('--color-ink');
  const canvas = token('--color-canvas');
  const edge = token('--color-border-strong');

  return [
    {
      selector: 'node',
      style: {
        // Degree-scaled, so the hubs of the network read as hubs. Computed in
        // the island and carried on the element's data.
        width: 'data(size)',
        height: 'data(size)',
        label: 'data(name)',
        color: ink,
        'font-size': 9,
        'font-weight': 500,
        'text-valign': 'bottom',
        'text-margin-y': 5,
        'text-max-width': '90px',
        'text-wrap': 'ellipsis',
        // Labels sit on top of edges, so they need their own backdrop to stay
        // legible. Colour is never the only carrier of meaning here.
        'text-outline-color': canvas,
        'text-outline-width': 2.5,
        // Cytoscape has no label collision handling — overlaps are resolved by
        // giving the layout room (see `layoutOptions`) and by dropping labels
        // once zooming has made them unreadable anyway. Selecting a node fades
        // its surroundings, which is the reliable way to read a crowded patch.
        'min-zoomed-font-size': 7,
        'border-width': 0,
        'transition-property': 'opacity, border-width',
        'transition-duration': 150,
      },
    },

    // One rule per label rather than a mapping function, so an unexpected label
    // falls back to the neutral default above instead of painting nothing.
    ...NODE_LABELS.map((label) => ({
      selector: `node[label = "${label}"]`,
      style: {
        'background-color': token(`--color-${label.toLowerCase()}`),
        'border-color': token(`--color-${label.toLowerCase()}`),
      },
    })),

    {
      selector: 'edge',
      style: {
        width: 1,
        'line-color': edge,
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': edge,
        'arrow-scale': 0.6,
        opacity: 0.65,
        'transition-property': 'opacity, width, line-color',
        'transition-duration': 150,
      },
    },

    // Selection outlines in the node's own colour, per §3. `border-color` comes
    // from the per-label rules above, so this only has to turn the ring on.
    //
    // A class rather than cytoscape's built-in `:selected`: the island runs
    // with `autounselectify`, so what is open lives in Svelte state alone and
    // the canvas cannot end up disagreeing with the inspector about it.
    {
      selector: 'node.selected',
      style: {
        'border-width': 3,
        'border-opacity': 1,
        'font-weight': 700,
        'font-size': 11,
        // The base width is sized for font-size 9. Emphasising a node to 11
        // makes its name ~20% wider, so without this a name that fit while
        // unemphasised ellipsizes the moment the reader selects it.
        'text-max-width': '130px',
      },
    },

    // §3 again: unconnected nodes dim rather than disappear, so the reader keeps
    // their spatial bearings while the selection is narrowed.
    { selector: '.faded', style: { opacity: 0.12, 'text-opacity': 0 } },

    {
      // `opacity` and `text-opacity` are restored here, not merely inherited.
      // A traced path routes through nodes that are not neighbours of the
      // selected one, so `.faded` above applies to them, and it is the rule
      // that hides labels outright. Without these two the middle of every path
      // rendered at 12% with no name on it — the trace appeared to run through
      // blank circles.
      selector: 'node.on-path',
      style: {
        'border-width': 3,
        'border-opacity': 1,
        'font-size': 11,
        'font-weight': 700,
        'text-max-width': '130px',
        opacity: 1,
        'text-opacity': 1,
      },
    },
    {
      selector: 'edge.on-path',
      style: { width: 3, 'line-color': ink, 'target-arrow-color': ink, opacity: 1 },
    },
  ];
}

/**
 * Spacing is set well above fcose's defaults on purpose. Nothing in cytoscape
 * moves a label out of the way of another one, so the only lever against 73
 * overlapping names is distance between the nodes carrying them.
 */
export function layoutOptions(animate: boolean): FcoseLayoutOptions {
  return {
    name: 'fcose',
    quality: 'proof',
    randomize: true,
    animate,
    animationDuration: 600,
    fit: true,
    padding: 60,
    nodeSeparation: 160,
    idealEdgeLength: 170,
    nodeRepulsion: 14000,
    tile: true,
    uniformNodeDimensions: false,
  };
}
