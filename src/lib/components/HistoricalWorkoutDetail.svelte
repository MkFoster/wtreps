<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import {
    observeHistoricalWorkout,
    type HistoricalWorkout,
  } from '#lib/data/repositories/historyRepository.js';
  import { deleteHistoricalWorkout } from '#lib/services/historicalWorkout.js';
  import { workoutDate, workoutDuration } from '#lib/utils/historyDisplay.js';
  import { WorkoutActionError } from '#lib/domain/workout.js';
  import ConfirmDialog from './ConfirmDialog.svelte';
  let { workoutId }: { workoutId: string } = $props();
  let detail = $state<HistoricalWorkout>();
  let status = $state<'loading' | 'ready' | 'missing' | 'error'>('loading');
  let retry = $state(0);
  let deleting = $state(false);
  let busy = $state(false);
  let error = $state('');
  $effect(() => {
    void retry;
    status = 'loading';
    const subscription = observeHistoricalWorkout(workoutId).subscribe({
      next: (value) => {
        detail = value;
        status = value ? 'ready' : 'missing';
      },
      error: (cause: unknown) => {
        console.error('History detail failed', cause);
        status = 'error';
      },
    });
    return () => subscription.unsubscribe();
  });
  async function remove() {
    if (busy) return;
    busy = true;
    error = '';
    try {
      await deleteHistoricalWorkout(workoutId);
      deleting = false;
      await goto('/history', { state: { workoutFeedback: 'Workout deleted' } });
    } catch (cause) {
      console.error('Workout delete failed', cause);
      error =
        cause instanceof WorkoutActionError
          ? cause.message
          : 'WtReps could not delete this workout. Please try again.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head
  ><title>{detail?.workout.circuitName ?? 'Workout'} · History · WtReps</title></svelte:head
>
<a class="back-link" href="/history">‹ History</a>
{#if status === 'loading'}<p role="status">Loading workout…</p>
{:else if status === 'error'}<h1>Workout unavailable</h1>
  <p role="alert">WtReps could not load this workout.</p>
  <button
    onclick={() => {
      retry += 1;
    }}>Retry</button
  >
{:else if status === 'missing'}<h1>Workout unavailable</h1>
  <p>This completed workout is no longer available on this device.</p>
{:else if detail}
  <h1>{detail.workout.circuitName}</h1>
  {#if page.state.workoutFeedback}<p class="success-message" role="status">
      {page.state.workoutFeedback}
    </p>{/if}
  {#if error && !deleting}<p class="error-banner" role="alert">{error}</p>{/if}
  <p>
    <time datetime={detail.workout.completedAt ?? undefined}
      >{workoutDate(detail.workout.completedAt, true)}</time
    ><br />{workoutDuration(detail.durationSeconds)} · {detail.completedSetCount}
    {detail.completedSetCount === 1 ? 'set' : 'sets'} · {detail.completedExerciseCount}
    {detail.completedExerciseCount === 1 ? 'exercise' : 'exercises'}
  </p>
  {#each detail.exercises.filter((row) => row.sets.length) as { exercise, settings, sets } (exercise.id)}
    <section class="history-exercise" aria-label={exercise.exerciseName}>
      <h2>{exercise.exerciseName}</h2>
      {#if settings.length}<dl>
          {#each settings as setting (setting.id)}<div>
              <dt>{setting.label}</dt>
              <dd>{setting.value}</dd>
            </div>{/each}
        </dl>{/if}
      {#each sets as set (set.id)}<p class="set-result">
          {set.weight}
          {exercise.weightUnit} × {set.reps} reps
        </p>{/each}
    </section>
  {:else}<p>No completed sets were recorded in this workout.</p>{/each}
  <a class="button-link" href={`/history/${workoutId}/edit`}>Edit Workout</a>
  <div class="delete-action">
    <button
      class="destructive-secondary"
      disabled={busy}
      onclick={() => {
        error = '';
        deleting = true;
      }}>Delete Workout</button
    >
  </div>
{/if}
{#if deleting && detail}<ConfirmDialog
    title="Delete this workout?"
    confirmLabel="Delete Workout"
    destructive
    {busy}
    oncancel={() => {
      deleting = false;
    }}
    onconfirm={() => {
      void remove();
    }}
  >
    <p>{detail.workout.circuitName}<br />{workoutDate(detail.workout.completedAt, true)}</p>
    <p>This will permanently remove the workout and its sets from this device.</p>
    {#if error}<p class="error-banner" role="alert">{error}</p>{/if}
  </ConfirmDialog>{/if}

<style>
  h1,
  h2,
  dt,
  dd {
    overflow-wrap: anywhere;
  }
  h2 {
    font-size: var(--font-size-large);
    margin: 0 0 var(--space-md);
  }
  .history-exercise {
    padding-block: var(--space-lg);
    border-top: 1px solid var(--color-border);
  }
  dl {
    margin: 0 0 var(--space-md);
  }
  dl div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-md);
  }
  dd {
    margin: 0;
    font-weight: 700;
  }
  .set-result {
    font-size: var(--font-size-large);
    margin: 0 0 var(--space-sm);
  }
  .delete-action {
    margin-top: 3rem;
  }
</style>
