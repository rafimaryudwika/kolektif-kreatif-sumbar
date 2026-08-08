<!--
  Detail for whatever is currently selected, fed by `/api/node`.

  The neighbour buttons are the keyboard route through the graph: every edge the
  canvas draws is also a focusable control here, so the network can be walked
  without a pointer. See `docs/design-system.md` §4.
-->
<script lang="ts">
  import { apiGet, errorMessage } from '../lib/client';
  import { groupTitle } from '../lib/relationships';
  import type { GraphNode, Neighbour, Neighbourhood } from '../lib/graph';

  interface Props {
    /** The selection, already known from the overview payload. */
    node: GraphNode | null;
    onselect: (id: string) => void;
    onclose: () => void;
  }

  let { node, onselect, onclose }: Props = $props();

  let detail = $state<Neighbourhood | null>(null);
  let loading = $state(false);
  let failure = $state<string | null>(null);

  $effect(() => {
    const target = node;
    if (!target) {
      detail = null;
      failure = null;
      return;
    }

    // Aborted on change, so clicking through the graph quickly cannot let a
    // slow earlier response overwrite the panel with the wrong node.
    const controller = new AbortController();
    loading = true;
    failure = null;

    apiGet<Neighbourhood>(
      '/api/node',
      { id: target.id, label: target.label },
      controller.signal,
    )
      .then((result) => {
        detail = result;
        loading = false;
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        detail = null;
        failure = errorMessage(error);
        loading = false;
      });

    return () => controller.abort();
  });

  interface Group {
    title: string;
    neighbours: Neighbour[];
  }

  /** Buckets neighbours by relationship and direction, in a stable order. */
  const groups = $derived.by<Group[]>(() => {
    const buckets = new Map<string, Group>();
    for (const neighbour of detail?.neighbours ?? []) {
      const key = `${neighbour.type}:${neighbour.direction}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { title: groupTitle(neighbour.type, neighbour.direction), neighbours: [] };
        buckets.set(key, bucket);
      }
      bucket.neighbours.push(neighbour);
    }
    for (const bucket of buckets.values()) {
      bucket.neighbours.sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...buckets.values()];
  });

  const dotClass: Record<string, string> = {
    Talent: 'bg-talent',
    Project: 'bg-project',
    Agency: 'bg-agency',
    Skill: 'bg-skill',
    Collective: 'bg-collective',
  };
</script>

{#if node}
  <div class="flex h-full flex-col">
    <div class="flex items-start justify-between gap-3 border-b border-border p-4">
      <div class="min-w-0">
        <p class="flex items-center gap-2 text-xs font-medium tracking-widest uppercase">
          <span class="size-2 shrink-0 rounded-full {dotClass[node.label]}" aria-hidden="true"
          ></span>
          <span class="text-ink-subtle">{node.label}</span>
        </p>
        <h2 class="mt-1.5 text-lg font-semibold text-balance">{node.name}</h2>
      </div>
      <button
        type="button"
        onclick={onclose}
        class="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink"
      >
        Close
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      {#if loading}
        <div class="space-y-3" aria-hidden="true">
          {#each [0, 1, 2] as row (row)}
            <div class="h-4 w-1/3 animate-pulse rounded bg-surface-raised"></div>
            <div class="h-8 animate-pulse rounded bg-surface-raised"></div>
          {/each}
        </div>
        <p class="sr-only" role="status">Loading connections.</p>
      {:else if failure}
        <p class="text-sm text-ink-muted">{failure}</p>
      {:else if groups.length === 0}
        <p class="text-sm text-ink-muted">
          No connections recorded yet. {node.name} is in the graph but nothing links to it.
        </p>
      {:else}
        <div class="space-y-5">
          {#each groups as group (group.title)}
            <section>
              <h3 class="text-xs font-medium tracking-wider text-ink-subtle uppercase">
                {group.title}
                <span class="text-ink-subtle/70">({group.neighbours.length})</span>
              </h3>
              <ul class="mt-2 space-y-1">
                {#each group.neighbours as neighbour (neighbour.id + neighbour.type)}
                  <li>
                    <button
                      type="button"
                      onclick={() => onselect(neighbour.id)}
                      class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-raised"
                    >
                      <span
                        class="size-1.5 shrink-0 rounded-full {dotClass[neighbour.label]}"
                        aria-hidden="true"
                      ></span>
                      <span class="min-w-0 flex-1 truncate">{neighbour.name}</span>
                      {#if neighbour.role}
                        <span class="shrink-0 text-xs text-ink-subtle">{neighbour.role}</span>
                      {/if}
                    </button>
                  </li>
                {/each}
              </ul>
            </section>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
