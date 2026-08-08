<!--
  Query B: the shortest chain of collaborations between two people.

  The point of the panel is the chain, not the number. "Four hops" says almost
  nothing; "you both worked with Lia Marlina, who is in Jaringan Dokumenter
  Minang with them" is the answer someone can act on — so the route is spelled
  out in full and simultaneously drawn on the canvas.
-->
<script lang="ts">
  import { apiGet, errorMessage } from '../lib/client';
  import { edgePhrase, hopLabel, introductionLabel } from '../lib/relationships';
  import type { GraphNode, PathPayload, PathResult } from '../lib/graph';

  interface Props {
    talents: GraphNode[];
    /** Highlights the route on the canvas; called with [] to clear it. */
    onhighlight: (ids: string[]) => void;
    onselect: (node: GraphNode) => void;
  }

  let { talents, onhighlight, onselect }: Props = $props();

  // The overview failed or came back empty. Without it the two selects have
  // nothing in them, and a form of empty dropdowns above "pick two people"
  // invites a click that cannot do anything. Say what is missing instead.
  const unavailable = $derived(talents.length === 0);

  let fromId = $state('');
  let toId = $state('');
  let result = $state<PathResult | null>(null);
  let searched = $state(false);
  let loading = $state(false);
  let failure = $state<string | null>(null);

  const sameTalent = $derived(fromId !== '' && fromId === toId);
  const ready = $derived(fromId !== '' && toId !== '' && !sameTalent);

  async function trace(event: SubmitEvent) {
    event.preventDefault();
    if (!ready) return;

    loading = true;
    failure = null;
    try {
      const payload = await apiGet<PathPayload>('/api/path', { from: fromId, to: toId });
      result = payload.path;
      searched = true;
      onhighlight(payload.path?.pathNodes.map((node) => node.id) ?? []);
    } catch (error) {
      result = null;
      searched = false;
      failure = errorMessage(error);
      onhighlight([]);
    } finally {
      loading = false;
    }
  }

  function nameOf(id: string): string {
    return talents.find((talent) => talent.id === id)?.name ?? 'that person';
  }

  const dotClass: Record<string, string> = {
    Talent: 'bg-talent',
    Project: 'bg-project',
    Agency: 'bg-agency',
    Skill: 'bg-skill',
    Collective: 'bg-collective',
  };
</script>

{#if unavailable}
  <p class="text-sm text-ink-muted">
    Tracing a connection needs the network loaded. Once the graph is available this
    panel lists everyone in it.
  </p>
{:else}
  <form onsubmit={trace} class="space-y-3">
    <label class="block">
      <span class="text-xs font-medium tracking-wider text-ink-subtle uppercase">From</span>
      <select
        bind:value={fromId}
        class="mt-1 w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm"
      >
        <option value="">Choose someone…</option>
        {#each talents as talent (talent.id)}
          <option value={talent.id}>{talent.name}</option>
        {/each}
      </select>
    </label>

    <label class="block">
      <span class="text-xs font-medium tracking-wider text-ink-subtle uppercase">To</span>
      <select
        bind:value={toId}
        class="mt-1 w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm"
      >
        <option value="">Choose someone…</option>
        {#each talents as talent (talent.id)}
          <option value={talent.id}>{talent.name}</option>
        {/each}
      </select>
    </label>

    {#if sameTalent}
      <p class="text-xs text-ink-muted">Pick two different people.</p>
    {/if}

    <button
      type="submit"
      disabled={!ready || loading}
      class="w-full rounded-md border border-border-strong px-3 py-2 text-sm font-medium hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? 'Tracing…' : 'Trace the connection'}
    </button>
  </form>

  <div class="mt-4">
    {#if failure}
      <p class="text-sm text-ink-muted">{failure}</p>
    {:else if searched && !result}
      <p class="text-sm text-ink-muted">
        No route between {nameOf(fromId)} and {nameOf(toId)} within four hops — no
        shared project, agency or collective joins them that closely. A longer chain
        may exist; the search stops at four because past that the link is not one
        either of them would recognise.
      </p>
    {:else if result}
      <p class="text-sm text-ink-muted">
        {#if introductionLabel(result.degrees)}
          <span class="font-medium text-ink">{introductionLabel(result.degrees)}</span>,
          {hopLabel(result.degrees)} through the network.
        {:else}
          Connected in <span class="font-medium text-ink">{hopLabel(result.degrees)}</span>.
        {/if}
      </p>

      <ol class="mt-3 space-y-1">
        {#each result.pathNodes as node, index (node.id)}
          <li>
            <button
              type="button"
              onclick={() => onselect(node)}
              class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-raised"
            >
              <span
                class="size-1.5 shrink-0 rounded-full {dotClass[node.label]}"
                aria-hidden="true"
              ></span>
              <span class="min-w-0 flex-1 truncate">{node.name}</span>
              <span class="shrink-0 text-xs text-ink-subtle">{node.label}</span>
            </button>

            {#if result.pathTypes[index]}
              <p class="ml-3.5 border-l border-border py-1 pl-4 text-xs text-ink-subtle">
                {edgePhrase(result.pathTypes[index], node.label)}
              </p>
            {/if}
          </li>
        {/each}
      </ol>
    {:else}
      <p class="text-sm text-ink-muted">
        Pick two people to see the shortest chain of shared projects, agencies and
        collectives between them.
      </p>
    {/if}
  </div>
{/if}
