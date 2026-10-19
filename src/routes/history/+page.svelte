<script lang="ts">
  import { page } from '$app/state';
  import {
    observeCompletedWorkouts,
    type listCompletedWorkouts,
  } from '#lib/data/repositories/historyRepository.js';
  import { workoutDate, workoutDuration } from '#lib/utils/historyDisplay.js';
  let entries = $state<Awaited<ReturnType<typeof listCompletedWorkouts>>>([]);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let retry = $state(0);
  $effect(() => {
    void retry;
    status = 'loading';
    const subscription = observeCompletedWorkouts().subscribe({
      next: (value) => {
        entries = value;
        status = 'ready';
      },
      error: (cause: unknown) => {
        console.error('History load failed', cause);
        status = 'error';
      },
    });
    return () => subscription.unsubscribe();
  });
</script>

<svelte:head><title>History · WtReps</title></svelte:head>
<h1>History</h1>
{#if page.state.workoutFeedback}<p class="success-message" role="status">
    {page.state.workoutFeedback}
  </p>{/if}
{#if status === 'loading'}<p role="status">Loading history…</p>
{:else if status === 'error'}<p role="alert">WtReps could not load your workout history.</p>
  <button
    onclick={() => {
      retry += 1;
    }}>Retry</button
  >
{:else if !entries.length}<h2>No workouts yet.</h2>
  <p>Complete your first workout and it will appear here.</p>
  <a class="button-link" href="/">Go to Home</a>
{:else}<ul aria-label="Completed workouts">
    {#each entries as entry (entry.workout.id)}<li>
        <a href={`/history/${entry.workout.id}`}>
          <time datetime={entry.workout.completedAt ?? undefined}
            >{workoutDate(entry.workout.completedAt)}</time
          >
          <strong>{entry.workout.circuitName}</strong>
          <span
            >{workoutDuration(entry.durationSeconds)} · {entry.completedSetCount}
            {entry.completedSetCount === 1 ? 'set' : 'sets'} · {entry.completedExerciseCount}
            {entry.completedExerciseCount === 1 ? 'exercise' : 'exercises'}</span
          >
        </a>
      </li>{/each}
  </ul>{/if}

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-md);
  }
  li a {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-lg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    text-decoration: none;
    overflow-wrap: anywhere;
  }
  strong {
    font-size: var(--font-size-large);
  }
  time,
  span {
    color: var(--color-muted);
  }
</style>
