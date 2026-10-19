<script lang="ts">
  import { page } from '$app/state';
  import {
    observeExerciseHistory,
    type getExerciseHistory,
  } from '#lib/data/repositories/historyRepository.js';
  import { workoutDate } from '#lib/utils/historyDisplay.js';
  let entries = $state<Awaited<ReturnType<typeof getExerciseHistory>>>([]);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let retry = $state(0);
  $effect(() => {
    void retry;
    status = 'loading';
    const subscription = observeExerciseHistory(page.params.id!).subscribe({
      next: (value) => {
        entries = value;
        status = 'ready';
      },
      error: (cause: unknown) => {
        console.error('Exercise history failed', cause);
        status = 'error';
      },
    });
    return () => subscription.unsubscribe();
  });
</script>

<svelte:head><title>Exercise History · WtReps</title></svelte:head>
<a class="back-link" href={`/exercises/${page.params.id}`}>‹ Exercise</a>
<h1>Exercise History</h1>
{#if status === 'loading'}<p role="status">Loading history…</p>
{:else if status === 'error'}<p role="alert">WtReps could not load this exercise history.</p>
  <button
    onclick={() => {
      retry += 1;
    }}>Retry</button
  >
{:else}
  {#if entries.length}<h2>{entries[0]!.exercise.exerciseName}</h2>{/if}
  {#each entries as { workout, exercise, sets } (exercise.id)}<section
      aria-label={workout.circuitName}
    >
      <a class="workout-link" href={`/history/${workout.id}`}
        ><time datetime={workout.completedAt ?? undefined}>{workoutDate(workout.completedAt)}</time
        ><strong>{workout.circuitName}</strong></a
      >
      {#each sets as set (set.id)}<p>{set.weight} {exercise.weightUnit} × {set.reps} reps</p>{/each}
    </section>{:else}<p>No workout history yet.</p>{/each}
{/if}

<style>
  h2 {
    font-size: var(--font-size-large);
    overflow-wrap: anywhere;
  }
  section {
    padding-block: var(--space-lg);
    border-top: 1px solid var(--color-border);
  }
  .workout-link {
    display: grid;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
    min-height: var(--touch-target-min);
    overflow-wrap: anywhere;
  }
  p {
    font-size: var(--font-size-large);
    margin-bottom: var(--space-sm);
  }
</style>
