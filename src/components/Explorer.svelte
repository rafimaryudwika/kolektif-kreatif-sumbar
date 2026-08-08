<!--
  The explorer shell: loads the graph once, owns the selection, and arranges the
  canvas against the side panel.

  Everything below this component is presentational — the canvas draws what it is
  given and reports taps, the panels render whatever is selected. Keeping the
  selection here is what lets search, the canvas, the path trace and the
  neighbour lists all move the same cursor.

  The three tabs are the three graph queries, deliberately: Detail is the
  one-hop neighbourhood, Path is the shortest chain between two people, Suggest
  is the multi-hop recommendation. Each is a question the relational version of
  this data would answer badly, which is the argument the README makes in prose.
-->
<script lang="ts">
  import GraphCanvas from './GraphCanvas.svelte';
  import Inspector from './Inspector.svelte';
  import PathPanel from './PathPanel.svelte';
  import RecommendPanel from './RecommendPanel.svelte';
  import SearchBox from './SearchBox.svelte';
  import { apiGet, errorMessage, ApiRequestError } from '../lib/client';
  import type { GraphNode, GraphOverview } from '../lib/graph';

  const TABS = [
    ['detail', 'Detail'],
    ['path', 'Path'],
    ['suggest', 'Suggest'],
  ] as const;

  type Tab = (typeof TABS)[number][0];

  let overview = $state<GraphOverview | null>(null);
  let loading = $state(true);
  let failure = $state<{ message: string; retryable: boolean } | null>(null);
  /**
   * The selection itself, not an id to resolve against the overview.
   *
   * `/api/search`, `/api/node` and `/api/path` each reach the database on their
   * own, so all three answer while the canvas is dark. Every panel already holds
   * a whole node for anything it offers to open, and looking that id back up in
   * the overview's map would throw the answer away — a hit the reader can see but
   * not open is worse than no hit at all.
   */
  let selected = $state<GraphNode | null>(null);
  let pathIds = $state<string[]>([]);
  let tab = $state<Tab>('detail');
  let canvas = $state<GraphCanvas | null>(null);

  let initialFrom = $state('');
  let initialTo = $state('');

  async function load() {
    loading = true;
    failure = null;
    try {
      overview = await apiGet<GraphOverview>('/api/graph');
      if (typeof window !== 'undefined' && overview) {
        const params = new URLSearchParams(window.location.search);
        const selectId = params.get('select') || params.get('node');
        const tabParam = params.get('tab');
        const fromParam = params.get('from');
        const toParam = params.get('to');

        if (fromParam) initialFrom = fromParam;
        if (toParam) initialTo = toParam;

        if (tabParam && (tabParam === 'detail' || tabParam === 'path' || tabParam === 'suggest')) {
          tab = tabParam;
        }

        if (selectId) {
          const match = overview.nodes.find((n) => n.id === selectId);
          if (match) {
            setTimeout(() => open(match), 100);
          }
        }
      }
    } catch (error) {
      overview = null;
      failure = {
        message: errorMessage(error),
        retryable: error instanceof ApiRequestError ? error.retryable : false,
      };
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    void load();
  });

  const nodes = $derived(overview?.nodes ?? []);
  const byId = $derived(new Map(nodes.map((node) => [node.id, node])));
  const selectedId = $derived(selected?.id ?? null);

  const byLabel = $derived.by(() => {
    const collate = (label: string) =>
      nodes.filter((node) => node.label === label).sort((a, b) => a.name.localeCompare(b.name));
    return { talents: collate('Talent'), skills: collate('Skill') };
  });

  /**
   * Talents holding at least one project credit.
   *
   * Query A walks out from the requester's own projects to the agencies that
   * produced them, so a talent with no `COLLABORATED_ON` edge returns nothing for
   * every skill in the list — not for want of a match, but because the traversal
   * has nowhere to start. The recommendation panel needs the distinction to keep
   * from sending the reader through all twelve skills for nothing.
   */
  const credited = $derived.by(() => {
    const ids = new Set<string>();
    for (const edge of overview?.edges ?? []) {
      if (edge.type === 'COLLABORATED_ON') ids.add(edge.source);
    }
    return ids;
  });

  /** Selecting from a list also moves the viewport, or the click looks inert. */
  function open(node: GraphNode | null) {
    selected = node;
    if (node) canvas?.focusNode(node.id);
  }

  /** The canvas reports taps by id, and can only have drawn what it was given. */
  function openById(id: string | null) {
    open(id ? (byId.get(id) ?? null) : null);
  }

  /** Opening something from a panel should show its detail. */
  function inspect(node: GraphNode) {
    tab = 'detail';
    open(node);
  }

  const empty = $derived(!loading && !failure && nodes.length === 0);
</script>

<div class="flex min-h-0 flex-1 flex-col md:flex-row">
  <div class="relative min-h-[55dvh] flex-1 md:min-h-0">
    {#if loading}
      <div class="absolute inset-0 grid place-items-center">
        <p class="text-sm text-ink-muted" role="status">Laying out the network…</p>
      </div>
    {:else if failure}
      <div class="absolute inset-0 grid place-items-center px-6">
        <div class="max-w-sm text-center">
          <h2 class="text-base font-semibold">The graph is not reachable</h2>
          <p class="mt-2 text-sm text-ink-muted">{failure.message}</p>
          {#if failure.retryable}
            <button
              type="button"
              onclick={load}
              class="mt-4 rounded-md border border-border-strong px-3 py-1.5 text-sm hover:bg-surface-raised"
            >
              Try again
            </button>
          {/if}
        </div>
      </div>
    {:else if empty}
      <!-- Reachable but unseeded. The distinction matters: this is a setup step
           that has not been run, not an outage. -->
      <div class="absolute inset-0 grid place-items-center px-6">
        <div class="max-w-sm text-center">
          <h2 class="text-base font-semibold">The graph is empty</h2>
          <p class="mt-2 text-sm text-ink-muted">
            The database is reachable but holds no entities yet. Run
            <code class="rounded bg-surface-raised px-1 py-0.5 text-xs">npm run seed</code>
            to populate it.
          </p>
        </div>
      </div>
    {:else if overview}
      <GraphCanvas
        bind:this={canvas}
        nodes={overview.nodes}
        edges={overview.edges}
        {selectedId}
        {pathIds}
        onselect={openById}
      />
    {/if}
  </div>

  <aside
    class="flex max-h-[45dvh] min-h-0 shrink-0 flex-col border-t border-border bg-surface md:max-h-none md:w-90 md:border-t-0 md:border-l"
    aria-label="Network tools"
  >
    <SearchBox onselect={inspect} />

    <div class="flex shrink-0 gap-1 border-b border-border px-3 py-2" role="tablist">
      {#each TABS as [id, title] (id)}
        <button
          type="button"
          role="tab"
          id="tab-{id}"
          aria-selected={tab === id}
          aria-controls="panel-{id}"
          onclick={() => (tab = id)}
          class="rounded-md px-3 py-1.5 text-sm font-medium {tab === id
            ? 'bg-surface-raised text-ink'
            : 'text-ink-muted hover:text-ink'}"
        >
          {title}
        </button>
      {/each}
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      {#if tab === 'detail'}
        <div role="tabpanel" id="panel-detail" aria-labelledby="tab-detail" class="h-full">
          {#if selected}
            <Inspector node={selected} onselect={inspect} onclose={() => open(null)} />
          {:else}
            <p class="p-4 text-sm text-ink-muted">
              Pick anyone on the canvas, or search above, to see who they have worked
              with and what they do.
            </p>
          {/if}
        </div>
      {:else if tab === 'path'}
        <div role="tabpanel" id="panel-path" aria-labelledby="tab-path" class="p-4">
          <PathPanel
            talents={byLabel.talents}
            {initialFrom}
            {initialTo}
            onhighlight={(ids) => (pathIds = ids)}
            onselect={inspect}
          />
        </div>
      {:else}
        <div role="tabpanel" id="panel-suggest" aria-labelledby="tab-suggest" class="p-4">
          <RecommendPanel
            talents={byLabel.talents}
            skills={byLabel.skills}
            {credited}
            onselect={inspect}
          />
        </div>
      {/if}
    </div>
  </aside>
</div>
