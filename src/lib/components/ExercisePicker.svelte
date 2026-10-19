<script lang="ts">
  import { observeExerciseList } from '#lib/data/repositories/exerciseRepository.js';
  import type { Exercise, ExerciseDetails } from '#lib/domain/exercise.js';
  import { summarizeSettings } from '#lib/domain/exerciseForm.js';

  let {
    excludedIds,
    onselect,
    oncreate,
    oncancel,
  }: {
    excludedIds: string[];
    onselect: (exercise: Exercise) => void;
    oncreate: () => void;
    oncancel: () => void;
  } = $props();
  let rows = $state<ExerciseDetails[]>([]);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let retry = $state(0);
  const available = $derived(rows.filter((row) => !excludedIds.includes(row.exercise.id)));

  $effect(() => {
    void retry;
    status = 'loading';
    const subscription = observeExerciseList().subscribe({
      next: (value) => {
        rows = value;
        status = 'ready';
      },
      error: (cause: unknown) => {
        console.error('Exercise picker failed', cause);
        status = 'error';
      },
    });
    return () => subscription.unsubscribe();
  });
</script>

<svelte:head><title>Add Exercise · WtReps</title></svelte:head>
<button class="secondary back-link" onclick={oncancel}>‹ Back to Circuit</button>
<h1>Add Exercise</h1>
{#if status === 'loading'}
  <p role="status">Loading exercises…</p>
{:else if status === 'error'}
  <p role="alert">WtReps could not load your exercises.</p>
  <button
    onclick={() => {
      retry += 1;
    }}>Retry</button
  >
{:else}
  {#if available.length}
    <ul class="picker-list">
      {#each available as { exercise, settings } (exercise.id)}
        <li>
          <button class="picker-row" onclick={() => onselect(exercise)}>
            <strong>{exercise.name}</strong>
            {#if settings.length}<span>{summarizeSettings(settings)}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {:else if rows.length}
    <p>All exercises are already in this circuit.</p>
  {:else}
    <h2>No exercises yet</h2>
    <p>Create your first exercise to add it to this circuit.</p>
  {/if}
  <button class="full-width" onclick={oncreate}>+ Create New Exercise</button>
{/if}

<style>
  .picker-list {
    padding: 0;
    margin: 0 0 var(--space-lg);
    list-style: none;
  }
  li {
    border-bottom: 1px solid var(--color-border);
  }
  .picker-row {
    display: grid;
    gap: var(--space-sm);
    width: 100%;
    text-align: left;
    color: var(--color-text);
    background: transparent;
    padding: var(--space-lg) var(--space-sm);
    border-radius: 0;
    overflow-wrap: anywhere;
  }
  strong,
  h2 {
    font-size: var(--font-size-large);
  }
  span {
    color: var(--color-muted);
    font-weight: 400;
  }
  .full-width {
    width: 100%;
    min-height: 56px;
  }
</style>
