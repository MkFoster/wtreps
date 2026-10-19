<script lang="ts">
  import { page } from '$app/state';
  import { getWorkoutSummary } from '#lib/data/repositories/workoutRepository.js';
  let data = $state<Awaited<ReturnType<typeof getWorkoutSummary>>>();
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let retry = $state(0);
  $effect(() => {
    void retry;
    let cancelled = false;
    status = 'loading';
    void getWorkoutSummary(page.params.id!)
      .then((value) => {
        if (!cancelled) {
          data = value;
          status = 'ready';
        }
      })
      .catch((cause: unknown) => {
        console.error('Summary load failed', cause);
        if (!cancelled) status = 'error';
      });
    return () => {
      cancelled = true;
    };
  });
</script>

<svelte:head><title>Workout Summary · WtReps</title></svelte:head>
{#if status === 'loading'}<p role="status">Loading summary…</p>
{:else if status === 'error'}<h1>Summary unavailable</h1>
  <p role="alert">WtReps could not load this summary.</p>
  <button
    onclick={() => {
      retry += 1;
    }}>Retry</button
  >
{:else if data?.workout.status === 'completed'}
  <h1>Workout Complete</h1>
  <p class="name">{data.workout.circuitName}</p>
  <dl>
    <div>
      <dt>Duration</dt>
      <dd>{Math.floor(data.durationSeconds / 60)} min {data.durationSeconds % 60} sec</dd>
    </div>
    <div>
      <dt>Exercises completed</dt>
      <dd>{data.completedExerciseCount}</dd>
    </div>
    <div>
      <dt>Completed sets</dt>
      <dd>{data.completedSetCount}</dd>
    </div>
  </dl>
  <a class="button-link view-workout" href={`/history/${data.workout.id}`}>View Workout</a>
{:else}<h1>Summary unavailable</h1>
  <p>This workout has not been completed.</p>{/if}
<a class="button-link" href="/">Done</a>

<style>
  .name {
    font-size: var(--font-size-large);
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  dl {
    margin-bottom: var(--space-lg);
  }
  dl div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-md);
    padding-block: var(--space-sm);
  }
  dd {
    margin: 0;
    font-weight: 700;
  }
  .view-workout {
    width: 100%;
    margin-bottom: var(--space-sm);
  }
</style>
