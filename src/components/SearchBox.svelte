<!--
  Search across every label, and the keyboard's way into the graph.

  Results are a list of buttons rather than a combobox: selecting one moves the
  canvas and opens the inspector instead of filling the field, so the usual
  autocomplete semantics would describe the wrong thing.
-->
<script lang="ts">
  import { apiGet, errorMessage } from '../lib/client';
  import type { GraphNode, SearchPayload, SearchResult } from '../lib/graph';

  interface Props {
    /**
     * Handed the whole hit, not just its id: `/api/search` answers even when the
     * overview did not, and the result carries enough to open the inspector on a
     * node the canvas never received.
     */
    onselect: (result: GraphNode) => void;
  }

  let { onselect }: Props = $props();

  /** Matches the floor `/api/search` enforces, so the 400 is never reached. */
  const MIN_TERM = 2;
  const DEBOUNCE_MS = 200;

  let term = $state('');
  let results = $state<SearchResult[]>([]);
  let searching = $state(false);
  let failure = $state<string | null>(null);
  let searched = $state('');

  $effect(() => {
    const query = term.trim();
    if (query.length < MIN_TERM) {
      results = [];
      searched = '';
      failure = null;
      return;
    }

    const controller = new AbortController();
    // One request per pause in typing, and the in-flight one is dropped rather
    // than left to land out of order.
    const timer = setTimeout(() => {
      searching = true;
      failure = null;
      apiGet<SearchPayload>('/api/search', { q: query }, controller.signal)
        .then((payload) => {
          results = payload.results;
          // The server's term, not the field's: the two differ once the next
          // keystroke has landed, and the empty state must name what was
          // actually searched for.
          searched = payload.term;
          searching = false;
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          results = [];
          failure = errorMessage(error);
          searching = false;
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });

  const dotClass: Record<string, string> = {
    Talent: 'bg-talent',
    Project: 'bg-project',
    Agency: 'bg-agency',
    Skill: 'bg-skill',
    Collective: 'bg-collective',
  };
</script>

<div class="border-b border-border p-3">
  <label class="block">
    <span class="sr-only">Search people, projects, agencies, collectives and skills</span>
    <input
      type="search"
      bind:value={term}
      placeholder="Search the network…"
      autocomplete="off"
      class="w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm placeholder:text-ink-subtle"
    />
  </label>

  {#if term.trim().length >= MIN_TERM}
    <div class="mt-2">
      {#if searching}
        <p class="px-1 text-xs text-ink-subtle" role="status">Searching…</p>
      {:else if failure}
        <p class="px-1 text-xs text-ink-muted">{failure}</p>
      {:else if results.length === 0 && searched}
        <p class="px-1 text-xs text-ink-muted">
          Nothing matches “{searched}”. Try part of a name, or a skill like Editing.
        </p>
      {:else}
        <ul class="max-h-64 overflow-y-auto">
          {#each results as result (result.id)}
            <li>
              <button
                type="button"
                onclick={() => onselect(result)}
                class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-raised"
              >
                <span
                  class="size-1.5 shrink-0 rounded-full {dotClass[result.label]}"
                  aria-hidden="true"
                ></span>
                <span class="min-w-0 flex-1 truncate">{result.name}</span>
                <span class="shrink-0 text-xs text-ink-subtle">
                  {result.detail || result.label}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>
