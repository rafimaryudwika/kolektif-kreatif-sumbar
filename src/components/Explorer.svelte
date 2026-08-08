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
  let selectedId = $state<string | null>(null);
  let pathIds = $state<string[]>([]);
  let tab = $state<Tab>('detail');
  let canvas = $state<GraphCanvas | null>(null);

  async function load() {
    loading = true;
    failure = null;
    try {
      overview = await apiGet<GraphOverview>('/api/graph');
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
  const selected = $derived<GraphNode | null>(selectedId ? (byId.get(selectedId) ?? null) : null);

  const byLabel = $derived.by(() => {
    const collate = (label: string) =>
      nodes.filter((node) => node.label === label).sort((a, b) => a.name.localeCompare(b.name));
    return { talents: collate('Talent'), skills: collate('Skill') };
  });

  /** Selecting from a list also moves the viewport, or the click looks inert. */
  function select(id: string | null) {
    selectedId = id;
    if (id) canvas?.focusNode(id);
  }

  /** Opening something from search or a path step should show its detail. */
  function inspect(id: string) {
    tab = 'detail';
    select(id);
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
        onselect={select}
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
            <Inspector node={selected} onselect={inspect} onclose={() => select(null)} />
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
            onhighlight={(ids) => (pathIds = ids)}
            onselect={inspect}
          />
        </div>
      {:else}
        <div role="tabpanel" id="panel-suggest" aria-labelledby="tab-suggest" class="p-4">
          <RecommendPanel talents={byLabel.talents} skills={byLabel.skills} onselect={inspect} />
        </div>
      {/if}
    </div>
  </aside>
</div>
