<!--
  EntityModal.svelte
  Social-media style floating window / modal for viewing entity details,
  involved people, and associated projects directly on the homepage.
-->
<script lang="ts">
  import { apiGet, errorMessage } from '../lib/client';
  import { groupTitle } from '../lib/relationships';
  import type { GraphNode, Neighbour, Neighbourhood, NodeLabel } from '../lib/graph';

  interface Props {
    node: GraphNode | null;
    onclose: () => void;
  }

  let { node, onclose }: Props = $props();

  let detail = $state<Neighbourhood | null>(null);
  let loading = $state(false);
  let failure = $state<string | null>(null);

  // History stack for navigating between entities inside the modal
  let history = $state<GraphNode[]>([]);

  $effect(() => {
    const current = node;
    if (!current) {
      detail = null;
      failure = null;
      history = [];
      return;
    }

    // Lock body scroll when modal is open
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }

    loadDetail(current);

    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  });

  async function loadDetail(target: GraphNode) {
    loading = true;
    failure = null;
    try {
      const res = await apiGet<Neighbourhood>('/api/node', {
        id: target.id,
        label: target.label,
      });
      detail = res;
    } catch (err: unknown) {
      detail = null;
      failure = errorMessage(err);
    } finally {
      loading = false;
    }
  }

  function navigateToNeighbour(neighbour: Neighbour) {
    if (detail?.node) {
      history = [...history, detail.node];
    }
    const nextNode: GraphNode = {
      id: neighbour.id,
      label: neighbour.label,
      name: neighbour.name,
    };
    loadDetail(nextNode);
  }

  function goBack() {
    if (history.length > 0) {
      const previous = history[history.length - 1];
      history = history.slice(0, -1);
      loadDetail(previous);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    }
  }

  const dotClass: Record<NodeLabel, string> = {
    Talent: 'bg-talent text-talent',
    Project: 'bg-project text-project',
    Agency: 'bg-agency text-agency',
    Skill: 'bg-skill text-skill',
    Collective: 'bg-collective text-collective',
  };

  const borderClass: Record<NodeLabel, string> = {
    Talent: 'border-talent/30',
    Project: 'border-project/30',
    Agency: 'border-agency/30',
    Skill: 'border-skill/30',
    Collective: 'border-collective/30',
  };

  const bgLightClass: Record<NodeLabel, string> = {
    Talent: 'bg-talent/10',
    Project: 'bg-project/10',
    Agency: 'bg-agency/10',
    Skill: 'bg-skill/10',
    Collective: 'bg-collective/10',
  };

  const currentNode = $derived(detail?.node ?? node);

  // Group neighbours by relationship & direction
  const groups = $derived.by(() => {
    if (!detail) return [];
    const map = new Map<string, { title: string; neighbours: Neighbour[] }>();
    for (const n of detail.neighbours) {
      const key = `${n.type}:${n.direction}`;
      const existing = map.get(key);
      if (existing) {
        existing.neighbours.push(n);
      } else {
        map.set(key, {
          title: groupTitle(n.type, n.direction),
          neighbours: [n],
        });
      }
    }
    return Array.from(map.values());
  });

  function getInitials(name: string) {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if node}
  <!-- Modal Backdrop -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    onclick={onclose}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <!-- Modal Content Window -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl transition-all sm:max-h-[80vh]"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Modal Header -->
      <div class="flex shrink-0 items-center justify-between border-b border-border bg-surface-raised/80 px-6 py-4 backdrop-blur-md">
        <div class="flex items-center gap-3 min-w-0">
          {#if history.length > 0}
            <button
              type="button"
              onclick={goBack}
              class="rounded-lg border border-border bg-surface p-1.5 text-ink-subtle transition hover:border-border-strong hover:text-ink"
              aria-label="Go back"
            >
              <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          {/if}

          {#if currentNode}
            <div class="flex items-center gap-3 truncate">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm border {bgLightClass[currentNode.label]} {borderClass[currentNode.label]} {dotClass[currentNode.label].split(' ')[1]}">
                {getInitials(currentNode.name)}
              </div>
              <div class="truncate">
                <div class="flex items-center gap-2">
                  <h2 id="modal-title" class="truncate text-lg font-bold text-ink">
                    {currentNode.name}
                  </h2>
                  <span class="shrink-0 rounded-full border border-border bg-canvas px-2.5 py-0.5 text-[11px] font-medium text-ink-subtle">
                    {currentNode.label}
                  </span>
                </div>
                <p class="text-xs text-ink-subtle">Sumbar Creative Network Node</p>
              </div>
            </div>
          {/if}
        </div>

        <button
          type="button"
          onclick={onclose}
          class="rounded-xl border border-border bg-surface p-2 text-ink-subtle transition hover:bg-surface-raised hover:text-ink"
          aria-label="Close modal"
        >
          <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Modal Body (Social Feed Style) -->
      <div class="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
        {#if loading}
          <div class="flex flex-col items-center justify-center py-12 text-ink-subtle gap-3">
            <div class="size-6 animate-spin rounded-full border-2 border-talent border-t-transparent"></div>
            <p class="text-sm font-medium">Fetching network data from CognoDB…</p>
          </div>
        {:else if failure}
          <div class="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-center text-sm text-red-300">
            <p class="font-semibold">Unable to load connections</p>
            <p class="mt-1 text-xs text-red-400">{failure}</p>
          </div>
        {:else if detail}
          {#if detail.neighbours.length === 0}
            <div class="rounded-xl border border-border bg-canvas p-8 text-center text-ink-muted">
              <p class="text-sm font-medium">No direct connections recorded yet.</p>
              <p class="mt-1 text-xs text-ink-subtle">This entity is listed in the database but currently has 0 direct edges.</p>
            </div>
          {:else}
            {#each groups as group (group.title)}
              <div class="space-y-3">
                <div class="flex items-center justify-between border-b border-border/60 pb-2">
                  <h3 class="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                    {group.title} ({group.neighbours.length})
                  </h3>
                </div>

                <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {#each group.neighbours as neighbour (neighbour.id)}
                    <button
                      type="button"
                      onclick={() => navigateToNeighbour(neighbour)}
                      class="group flex items-start gap-3 rounded-xl border border-border bg-surface-raised/50 p-3 text-left transition hover:border-border-strong hover:bg-surface-raised hover:shadow-md"
                    >
                      <div class="flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold border {bgLightClass[neighbour.label]} {borderClass[neighbour.label]} {dotClass[neighbour.label].split(' ')[1]} mt-0.5">
                        {getInitials(neighbour.name)}
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-semibold text-ink group-hover:text-talent">
                          {neighbour.name}
                        </p>
                        <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-subtle">
                          {#if neighbour.role}
                            <span class="rounded bg-canvas px-1.5 py-0.5 font-medium text-ink-muted border border-border/80">
                              {neighbour.role}
                            </span>
                          {/if}
                          <span class="text-[11px]">
                            {neighbour.label}
                          </span>
                        </div>
                      </div>
                      <svg class="size-4 shrink-0 text-ink-subtle opacity-0 transition group-hover:opacity-100 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          {/if}
        {/if}
      </div>

      <!-- Modal Footer -->
      {#if currentNode}
        <div class="flex shrink-0 flex-col sm:flex-row items-center justify-between gap-3 border-t border-border bg-surface-raised/80 px-6 py-4 backdrop-blur-md">
          <p class="text-xs text-ink-subtle text-center sm:text-left">
            Click any profile above to explore deeper in this popup.
          </p>

          <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onclick={onclose}
              class="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-ink transition hover:bg-border"
            >
              Close
            </button>

            <a
              href="/explore?select={encodeURIComponent(currentNode.id)}"
              class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-talent px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-blue-600 focus:outline-none"
            >
              <span>Explore in Graph Canvas 🕸️</span>
            </a>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
