<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { observeExerciseList } from '#lib/data/repositories/exerciseRepository.js';
  import type { ExerciseDetails } from '#lib/domain/exercise.js';
  import { summarizeSettings } from '#lib/domain/exerciseForm.js';

  let rows = $state<ExerciseDetails[]>([]);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let message = $state('');
  let retry = $state(0);

  $effect(() => {
    void retry;
    status = 'loading';
    const subscription = observeExerciseList().subscribe({
      next: (value) => {
        rows = value;
        status = 'ready';
      },
      error: (cause: unknown) => {
        console.error('Exercise list failed', cause);
        status = 'error';
      },
    });
    return () => subscription.unsubscribe();
  });

  onMount(() => {
    message = page.state.exerciseFeedback ?? '';
    if (message) void goto('/exercises', { shallow: true, replace: true, state: {} });
    const timer = setTimeout(() => {
      message = '';
    }, 5000);
    return () => clearTimeout(timer);
  });
</script>

<svelte:head><title>Exercises · WtReps</title></svelte:head>
<a class="back-link" href="/manage">‹ Manage</a>
<h1>Exercises</h1>
{#if message}<p class="success-message" role="status">{message}</p>{/if}
{#if status === 'loading'}
  <p role="status">Loading exercises…</p>
{:else if status === 'error'}
  <p class="error-banner" role="alert">WtReps could not load your exercises.</p>
  <button
    onclick={() => {
      retry += 1;
    }}>Retry</button
  >
{:else}
  {#if rows.length}
    <ul class="exercise-list">
      {#each rows as { exercise, settings } (exercise.id)}
        <li>
          <a href={`/exercises/${exercise.id}`}>
            <strong>{exercise.name}</strong>
            {#if settings.length}<span>{summarizeSettings(settings)}</span>{/if}
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <h2>No exercises yet</h2>
    <p>Add an exercise and the machine settings you use at the gym.</p>
  {/if}
  <a class="button-link" href="/exercises/new">+ New Exercise</a>
{/if}

<style>
  .exercise-list {
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
  strong {
    font-size: var(--font-size-large);
  }
  span {
    color: var(--color-muted);
  }
  h2 {
    font-size: var(--font-size-large);
  }
</style>
