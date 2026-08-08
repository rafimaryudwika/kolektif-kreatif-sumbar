<!--
  HomeSearch.svelte
  Interactive search and network discovery component for the landing page.
  Enables non-technical users to query the graph ecosystem immediately.
-->
<script lang="ts">
  import { apiGet, errorMessage } from '../lib/client';
  import type { SearchPayload, SearchResult } from '../lib/graph';

  const MIN_TERM = 2;
  const DEBOUNCE_MS = 200;

  let term = $state('');
  let results = $state<SearchResult[]>([]);
  let searching = $state(false);
  let failure = $state<string | null>(null);
  let searched = $state('');
  let isFocused = $state(false);

  $effect(() => {
    const query = term.trim();
    if (query.length < MIN_TERM) {
      results = [];
      searched = '';
      failure = null;
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      searching = true;
      failure = null;
      apiGet<SearchPayload>('/api/search', { q: query }, controller.signal)
        .then((payload) => {
          results = payload.results;
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

  type NodeLabel = 'Talent' | 'Project' | 'Agency' | 'Skill' | 'Collective';

  const dotClass: Record<string, string> = {
    Talent: 'bg-talent',
    Project: 'bg-project',
    Agency: 'bg-agency',
    Skill: 'bg-skill',
    Collective: 'bg-collective',
  };

  const SAMPLE_QUERIES: Array<{ label: string; id: string; type: NodeLabel }> = [
    { label: 'Directing', id: 'skill-directing', type: 'Skill' },
    { label: 'Cinematography', id: 'skill-cinematography', type: 'Skill' },
    { label: 'CineSumbar', id: 'collective-cinesumbar', type: 'Collective' },
    { label: 'Sound Design', id: 'skill-sound-design', type: 'Skill' },
    { label: 'Producing', id: 'skill-producing', type: 'Skill' },
  ];

  function navigateTo(id: string) {
    window.location.href = `/explore?select=${encodeURIComponent(id)}`;
  }
</script>

<div class="mt-8 flex flex-col gap-6">
  <!-- Search Input Container -->
  <div class="relative w-full">
    <div class="relative flex items-center">
      <svg
        class="pointer-events-none absolute left-4 size-5 text-ink-subtle"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>

      <input
        type="search"
        bind:value={term}
        onfocus={() => (isFocused = true)}
        onblur={() => setTimeout(() => (isFocused = false), 200)}
        placeholder="Search filmmakers, skills (e.g. Directing), projects, agencies, or collectives…"
        autocomplete="off"
        class="w-full rounded-xl border border-border bg-surface py-3.5 pr-10 pl-11 text-base text-ink shadow-lg transition placeholder:text-ink-subtle focus:border-talent focus:ring-1 focus:ring-talent focus:outline-none"
      />

      {#if term}
        <button
          type="button"
          onclick={() => (term = '')}
          class="absolute right-3 rounded-md p-1 text-ink-subtle hover:text-ink"
          aria-label="Clear search"
        >
          <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      {/if}
    </div>

    <!-- Dropdown Search Results -->
    {#if term.trim().length >= MIN_TERM && isFocused}
      <div
        class="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface-raised p-2 shadow-2xl backdrop-blur-md"
      >
        {#if searching}
          <div class="flex items-center gap-2 px-3 py-3 text-sm text-ink-subtle" role="status">
            <div class="size-4 animate-spin rounded-full border-2 border-talent border-t-transparent"></div>
            <span>Searching graph database…</span>
          </div>
        {:else if failure}
          <p class="px-3 py-2.5 text-sm text-ink-muted">{failure}</p>
        {:else if results.length === 0 && searched}
          <div class="px-3 py-3 text-sm text-ink-muted">
            <p class="font-medium text-ink">No entities match “{searched}”</p>
            <p class="mt-1 text-xs text-ink-subtle">
              Try search terms like <span class="font-mono text-ink">Directing</span>, <span class="font-mono text-ink">Sumbar</span>, or a project title.
            </p>
          </div>
        {:else}
          <ul class="max-h-72 overflow-y-auto">
            {#each results as result (result.id)}
              <li>
                <button
                  type="button"
                  onmousedown={() => navigateTo(result.id)}
                  class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-surface"
                >
                  <span
                    class="size-2.5 shrink-0 rounded-full {dotClass[result.label]}"
                    aria-hidden="true"
                  ></span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium text-ink">{result.name}</p>
                    {#if result.detail}
                      <p class="truncate text-xs text-ink-subtle">{result.detail}</p>
                    {/if}
                  </div>
                  <span class="shrink-0 rounded bg-canvas px-2 py-0.5 text-xs text-ink-subtle border border-border">
                    {result.label}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Quick Search Pills -->
  <div class="flex flex-wrap items-center gap-2 text-xs">
    <span class="font-medium text-ink-subtle">💡 Sample Entities:</span>
    {#each SAMPLE_QUERIES as sample (sample.id)}
      <button
        type="button"
        onclick={() => navigateTo(sample.id)}
        class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-ink-muted transition hover:border-talent hover:text-ink hover:bg-surface-raised"
      >
        <span class="size-1.5 rounded-full {dotClass[sample.type]}" aria-hidden="true"></span>
        {sample.label}
      </button>
    {/each}
  </div>

  <!-- Interactive Action Cards (Use Case Discovery) -->
  <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
    <!-- Card 1: Multi-Hop Suggestion -->
    <a
      href="/explore?tab=suggest"
      class="group flex flex-col justify-between rounded-xl border border-border bg-surface p-5 transition duration-200 hover:-translate-y-0.5 hover:border-talent/50 hover:bg-surface-raised hover:shadow-lg"
    >
      <div>
        <div class="flex items-center justify-between">
          <span class="rounded-lg bg-talent/10 p-2 text-talent">
            <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </span>
          <span class="text-xs text-ink-subtle font-mono">4-Hop Traversal</span>
        </div>
        <h3 class="mt-3 text-base font-semibold text-ink group-hover:text-talent">
          Collaborator Referrals
        </h3>
        <p class="mt-1.5 text-xs text-ink-muted leading-relaxed">
          Discover trusted talent recommendations based on shared collectives and past project networks.
        </p>
      </div>
      <div class="mt-4 flex items-center text-xs font-medium text-talent">
        <span>Explore Referrals</span>
        <svg class="ml-1 size-3.5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </div>
    </a>

    <!-- Card 2: Shortest Path -->
    <a
      href="/explore?tab=path"
      class="group flex flex-col justify-between rounded-xl border border-border bg-surface p-5 transition duration-200 hover:-translate-y-0.5 hover:border-project/50 hover:bg-surface-raised hover:shadow-lg"
    >
      <div>
        <div class="flex items-center justify-between">
          <span class="rounded-lg bg-project/10 p-2 text-project">
            <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </span>
          <span class="text-xs text-ink-subtle font-mono">Degrees of Separation</span>
        </div>
        <h3 class="mt-3 text-base font-semibold text-ink group-hover:text-project">
          Degrees of Separation
        </h3>
        <p class="mt-1.5 text-xs text-ink-muted leading-relaxed">
          Calculate degrees of separation and discover connecting routes between any two creative talents.
        </p>
      </div>
      <div class="mt-4 flex items-center text-xs font-medium text-project">
        <span>Find Connection Path</span>
        <svg class="ml-1 size-3.5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </div>
    </a>

    <!-- Card 3: Interactive Graph Explorer -->
    <a
      href="/explore"
      class="group flex flex-col justify-between rounded-xl border border-border bg-surface p-5 transition duration-200 hover:-translate-y-0.5 hover:border-collective/50 hover:bg-surface-raised hover:shadow-lg"
    >
      <div>
        <div class="flex items-center justify-between">
          <span class="rounded-lg bg-collective/10 p-2 text-collective">
            <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </span>
          <span class="text-xs text-ink-subtle font-mono">Cytoscape Canvas</span>
        </div>
        <h3 class="mt-3 text-base font-semibold text-ink group-hover:text-collective">
          Ecosystem Canvas Map
        </h3>
        <p class="mt-1.5 text-xs text-ink-muted leading-relaxed">
          Visually traverse all connected nodes (Talent, Project, Skill, Agency, Collective) in a live graph.
        </p>
      </div>
      <div class="mt-4 flex items-center text-xs font-medium text-collective">
        <span>Open Interactive Canvas</span>
        <svg class="ml-1 size-3.5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </div>
    </a>
  </div>
</div>
