<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { observeCircuits } from '#lib/data/repositories/circuitRepository.js';
  import type { CircuitSummary } from '#lib/domain/circuit.js';

  let rows = $state<CircuitSummary[]>([]);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let message = $state('');
  let retry = $state(0);
  $effect(() => {
    void retry;
    status = 'loading';
    const subscription = observeCircuits().subscribe({
      next: (value) => {
        rows = value;
        status = 'ready';
      },
      error: (cause: unknown) => {
        console.error('Circuit list failed', cause);
        status = 'error';
      },
    });
    return () => subscription.unsubscribe();
  });
  onMount(() => {
    message = page.state.circuitFeedback ?? '';
    if (message) void goto('/circuits', { shallow: true, replace: true, state: {} });
    const timer = setTimeout(() => {
      message = '';
    }, 5000);
    return () => clearTimeout(timer);
  });
</script>

<svelte:head><title>Circuits · WtReps</title></svelte:head>
<a class="back-link" href="/manage">‹ Manage</a>
<h1>Circuits</h1>
{#if message}<p class="success-message" role="status">{message}</p>{/if}
{#if status === 'loading'}<p role="status">Loading circuits…</p>
{:else if status === 'error'}
  <p class="error-banner" role="alert">WtReps could not load your circuits.</p>
  <button
    onclick={() => {
      retry += 1;
    }}>Retry</button
  >
{:else}
  {#if rows.length}
    <ul class="circuit-list">
      {#each rows as { circuit, exerciseCount } (circuit.id)}
        <li>
          <a href={`/circuits/${circuit.id}`}
            ><strong>{circuit.name}</strong><span
              >{exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}</span
            >{#if exerciseCount === 0}<span>Add exercises before a workout.</span>{/if}</a
          >
        </li>
      {/each}
    </ul>
  {:else}<h2>No circuits yet</h2>
    <p>Create a circuit with the exercises you use at the gym.</p>{/if}
  <a class="button-link" href="/circuits/new">+ New Circuit</a>
{/if}

<style>
  .circuit-list {
    padding: 0;
    margin: 0 0 var(--space-lg);
    list-style: none;
  }
  li {
    border-bottom: 1px solid var(--color-border);
  }
  li a {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-lg) var(--space-sm);
    min-height: 72px;
    text-decoration: none;
    overflow-wrap: anywhere;
  }
  strong,
  h2 {
    font-size: var(--font-size-large);
  }
  span {
    color: var(--color-muted);
  }
</style>
