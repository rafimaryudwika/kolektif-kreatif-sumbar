<!--
  Query A: who to hire next.

  People who share a production agency with you and have the skill you need, but
  whom you have never actually worked with. Every suggestion carries the route
  that produced it — the recommendation is only worth as much as the reason, and
  a bare ranked list would hide the part a graph is uniquely able to show.
-->
<script lang="ts">
  import { apiGet, errorMessage } from '../lib/client';
  import type { GraphNode, RecommendationPayload } from '../lib/graph';

  interface Props {
    talents: GraphNode[];
    skills: GraphNode[];
    onselect: (id: string) => void;
  }

  let { talents, skills, onselect }: Props = $props();

  let talentId = $state('');
  let skill = $state('');
  // The answer carries the talent and skill the server used, so the result text
  // keeps describing the request that produced it even after the selects move.
  let answer = $state<RecommendationPayload | null>(null);
  let loading = $state(false);
  let failure = $state<string | null>(null);

  const ready = $derived(talentId !== '' && skill !== '');

  async function suggest(event: SubmitEvent) {
    event.preventDefault();
    if (!ready) return;

    loading = true;
    failure = null;
    try {
      answer = await apiGet<RecommendationPayload>('/api/recommendations', { talentId, skill });
    } catch (error) {
      answer = null;
      failure = errorMessage(error);
    } finally {
      loading = false;
    }
  }

  function nameOf(id: string): string {
    return talents.find((talent) => talent.id === id)?.name ?? 'that person';
  }
</script>

<form onsubmit={suggest} class="space-y-3">
  <label class="block">
    <span class="text-xs font-medium tracking-wider text-ink-subtle uppercase">
      Crewing for
    </span>
    <select
      bind:value={talentId}
      class="mt-1 w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm"
    >
      <option value="">Choose someone…</option>
      {#each talents as talent (talent.id)}
        <option value={talent.id}>{talent.name}</option>
      {/each}
    </select>
  </label>

  <label class="block">
    <span class="text-xs font-medium tracking-wider text-ink-subtle uppercase">
      Who can do
    </span>
    <select
      bind:value={skill}
      class="mt-1 w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm"
    >
      <option value="">Choose a skill…</option>
      {#each skills as entry (entry.id)}
        <option value={entry.name}>{entry.name}</option>
      {/each}
    </select>
  </label>

  <button
    type="submit"
    disabled={!ready || loading}
    class="w-full rounded-md border border-border-strong px-3 py-2 text-sm font-medium hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
  >
    {loading ? 'Looking…' : 'Find people'}
  </button>
</form>

<div class="mt-4">
  {#if failure}
    <p class="text-sm text-ink-muted">{failure}</p>
  {:else if answer && answer.recommendations.length === 0}
    <p class="text-sm text-ink-muted">
      Nobody with {answer.skill} shares an agency with {nameOf(answer.talentId)} yet.
      Try a different skill, or someone with more credits.
    </p>
  {:else if answer}
    <p class="text-sm text-ink-muted">
      {answer.recommendations.length}
      {answer.recommendations.length === 1 ? 'person' : 'people'} with {answer.skill},
      reachable through shared agencies.
    </p>

    <ul class="mt-3 space-y-3">
      {#each answer.recommendations as person (person.talentId)}
        <li class="rounded-lg border border-border bg-surface-raised p-3">
          <button
            type="button"
            onclick={() => onselect(person.talentId)}
            class="text-left text-sm font-medium hover:underline"
          >
            {person.talentName}
          </button>
          <p class="text-xs text-ink-subtle">{person.talentRole}</p>

          <ul class="mt-2 space-y-1.5 border-t border-border pt-2">
            <!-- Unkeyed on purpose: these are evidence rows, not entities. Two
                 of them can differ only in `yourProject` — one person reachable
                 through the same agency by two projects of yours — so no field
                 or combination of fields is a stable identity. -->
            {#each person.connections as connection}
              <li class="text-xs text-ink-muted">
                Both worked for <span class="text-ink">{connection.viaAgency}</span> —
                you on {connection.yourProject}, them on {connection.theirProject}
                as {connection.roleOnProject}.
              </li>
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-sm text-ink-muted">
      Pick a person and a skill to find collaborators they have not met yet, but who
      already work with the same agencies.
    </p>
  {/if}
</div>
