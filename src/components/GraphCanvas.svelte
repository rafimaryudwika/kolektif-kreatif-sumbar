<!--
  The graph canvas.

  Cytoscape owns a `<canvas>` and its own scene graph, which does not fit
  Svelte's rendering model — so the component is deliberately one-way. Props
  come in, an effect reconciles the existing instance rather than rebuilding it,
  and the only thing that goes back out is a selected id. Rebuilding on every
  prop change would re-run the force layout and throw away the reader's mental
  map of where things are.

  Accessibility: a canvas cannot be a tab stop with meaningful children, so this
  component is not the keyboard route into the graph. Search reaches any node by
  name, the inspector's neighbour buttons walk the edges, and the live region
  below announces each selection in words. The canvas is the fast path for a
  mouse, not the only path. See `docs/design-system.md` §4.
-->
<script lang="ts">
  import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
  import fcose from 'cytoscape-fcose';
  import { graphStylesheet, layoutOptions, prefersReducedMotion } from '../lib/graph-style';
  import type { GraphEdge, GraphNode } from '../lib/graph';

  interface Props {
    nodes: GraphNode[];
    edges: GraphEdge[];
    selectedId: string | null;
    /** Ordered node ids of a path to highlight; empty when none is shown. */
    pathIds?: string[];
    onselect: (id: string | null) => void;
  }

  let { nodes, edges, selectedId, pathIds = [], onselect }: Props = $props();

  let container: HTMLDivElement;
  let cy: Core | null = null;

  // Registration is global to the cytoscape module and throws if repeated, so
  // it is guarded rather than run at import time — an island can mount twice.
  let registered = false;
  function registerLayout() {
    if (registered) return;
    cytoscape.use(fcose);
    registered = true;
  }

  function elements(): ElementDefinition[] {
    const present = new Set(nodes.map((node) => node.id));
    const degree = new Map<string, number>();

    // Edges whose endpoints are missing would make cytoscape throw on init.
    // Every label we query is in `nodes`, so this should never drop anything —
    // it is here so a schema change degrades into a thinner graph instead of a
    // blank screen.
    const usable = edges.filter((edge) => present.has(edge.source) && present.has(edge.target));

    for (const edge of usable) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }

    return [
      ...nodes.map((node) => ({
        data: {
          ...node,
          // Area grows with degree, radius with its square root, so a node with
          // ten connections looks like a hub without dwarfing everything else.
          size: 16 + Math.sqrt(degree.get(node.id) ?? 0) * 7,
        },
      })),
      ...usable.map((edge) => ({ data: { ...edge } })),
    ];
  }

  /** Dims everything not adjacent to the selection, per design-system §3. */
  function applySelection(instance: Core, id: string | null) {
    instance.batch(() => {
      instance.elements().removeClass('faded selected');
      if (!id) return;

      const node = instance.getElementById(id);
      if (node.empty()) return;

      const near = node.closedNeighborhood();
      instance.elements().not(near).addClass('faded');
      node.addClass('selected');
    });
  }

  function applyPath(instance: Core, ids: string[]) {
    const onPath = instance.collection();

    instance.batch(() => {
      instance.elements().removeClass('on-path');
      if (ids.length < 2) return;

      for (const [index, id] of ids.entries()) {
        const node = instance.getElementById(id);
        if (node.empty()) continue;
        onPath.merge(node);

        // The path is a walk, so consecutive ids share an edge. Direction is
        // not known here — Query B traverses undirected — so both are tried.
        const next = ids[index + 1];
        if (next) onPath.merge(node.edgesWith(instance.getElementById(next)));
      }
      onPath.addClass('on-path');
    });

    // Highlighting alone is not enough. The chain is usually spread across the
    // graph, and at the zoom left over from a previous selection an endpoint can
    // sit outside the viewport entirely — the trace reads as broken because the
    // node it ends on is not on screen. Reframing is what makes it legible
    // without the reader panning to find it.
    if (onPath.nonempty()) {
      // Padding is generous because cytoscape fits to node bounding boxes and
      // ours carry their label underneath, outside that box. At a tighter value
      // the endpoints land against the edge with their names half cut off.
      instance.animate(
        { fit: { eles: onPath, padding: 140 } },
        { duration: prefersReducedMotion() ? 0 : 350 },
      );
    }
  }

  $effect(() => {
    registerLayout();

    const instance = cytoscape({
      container,
      elements: elements(),
      style: graphStylesheet(),
      // Selection state lives in Svelte, not in cytoscape, so there is only one
      // answer to "what is open" and the two cannot drift apart.
      autounselectify: true,
      minZoom: 0.2,
      maxZoom: 3,
    });

    instance.on('tap', 'node', (event) => onselect(event.target.id() as string));
    instance.on('tap', (event) => {
      if (event.target === instance) onselect(null);
    });

    instance.layout(layoutOptions(!prefersReducedMotion())).run();
    cy = instance;

    return () => {
      // Cytoscape holds canvas contexts and window listeners; without this the
      // island leaks one full renderer per navigation.
      instance.destroy();
      cy = null;
    };
  });

  // Separate effects so a selection change never re-runs the layout: this one
  // reads `selectedId`, the one above does not.
  $effect(() => {
    if (cy) applySelection(cy, selectedId);
  });

  $effect(() => {
    if (cy) applyPath(cy, pathIds);
  });

  const selectedName = $derived(nodes.find((node) => node.id === selectedId));

  export function focusNode(id: string) {
    if (!cy) return;
    const node = cy.getElementById(id);
    if (node.empty()) return;
    cy.animate(
      { center: { eles: node }, zoom: Math.max(cy.zoom(), 1.1) },
      { duration: prefersReducedMotion() ? 0 : 350 },
    );
  }
</script>

<div class="relative size-full">
  <div bind:this={container} class="size-full" aria-hidden="true"></div>

  <p class="sr-only" role="status">
    {selectedName
      ? `Selected: ${selectedName.name}, a ${selectedName.label.toLowerCase()}.`
      : 'Nothing selected. Use search to open an entity.'}
  </p>
</div>
