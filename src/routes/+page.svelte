<script lang="ts">
  import { goto } from '$app/navigation';
  import { observeHome, type HomeData } from '#lib/data/repositories/homeRepository.js';
  import { startWorkout } from '#lib/services/startWorkout.js';
  import { WorkoutActionError } from '#lib/domain/workout.js';
  import AbandonWorkoutButton from '#lib/components/AbandonWorkoutButton.svelte';

  let data = $state<HomeData>();
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let busy = $state(false);
  let error = $state('');
  let retry = $state(0);
  $effect(() => {
    void retry;
    status = 'loading';
    const subscription = observeHome().subscribe({
      next: (value) => {
        data = value;
        status = 'ready';
      },
      error: (cause: unknown) => {
        console.error('Home load failed', cause);
        status = 'error';
      },
    });
    return () => subscription.unsubscribe();
  });

  async function start(circuitId: string) {
    if (busy || data?.active) return;
    busy = true;
    error = '';
    try {
      const workout = await startWorkout(circuitId);
      try {
        await goto(`/workout/${workout.id}`);
      } catch (cause) {
        console.error('Workout navigation failed', cause);
        error = 'Your workout was saved. Use Resume Workout to open it.';
      }
    } catch (cause) {
      console.error('Workout start failed', cause);
      error =
        cause instanceof WorkoutActionError
          ? cause.message
          : 'WtReps could not start this workout. Please try again.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>WtReps</title></svelte:head>
<h1>Your workout</h1>
{#if error}<p class="error-banner" role="alert">{error}</p>{/if}
{#if status === 'loading'}<p role="status">Loading workouts…</p>
{:else if status === 'error'}
  <p class="error-banner" role="alert">WtReps could not load your workout data.</p>
  <button
    onclick={() => {
      retry += 1;
    }}>Retry</button
  >
{:else if data}
  {#if data.active}
    <section class="resume-card" aria-labelledby="resume-title">
      <h2 id="resume-title">Workout in Progress</h2>
      <p class="circuit-name">{data.active.workout.circuitName}</p>
      <p>
        Started {new Date(data.active.workout.startedAt).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
      </p>
      {#if data.active.exerciseCount}<p>
          Exercise {data.active.currentExerciseNumber} of {data.active.exerciseCount}
        </p>{/if}
      <a class="button-link" href={`/workout/${data.active.workout.id}`}>Resume Workout</a>
      <AbandonWorkoutButton workoutId={data.active.workout.id} label="Abandon" />
    </section>
  {/if}
  {#if data.circuits.length}
    <h2>Your Circuits</h2>
    <div class="circuits">
      {#each data.circuits as { circuit, exerciseCount } (circuit.id)}
        <section class="circuit-card" aria-label={circuit.name}>
          <h3>{circuit.name}</h3>
          <p>{exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}</p>
          {#if exerciseCount}
            <button
              disabled={busy || !!data.active}
              onclick={() => {
                void start(circuit.id);
              }}>Start Workout</button
            >
          {:else}
            <p>Add exercises before starting a workout.</p>
            <a class="back-link" href={`/circuits/${circuit.id}`}>Add Exercises</a>
          {/if}
        </section>
      {/each}
    </div>
    <a class="back-link" href="/circuits/new">+ New Circuit</a>
  {:else}
    <h2>No circuits yet</h2>
    <p>Create a circuit with the exercises you use at the gym.</p>
    <a class="button-link" href="/circuits/new">Create Your First Circuit</a>
  {/if}
{/if}

<style>
  h2,
  h3,
  .circuit-name {
    font-size: var(--font-size-large);
  }
  h2,
  h3 {
    margin: 0 0 var(--space-md);
    overflow-wrap: anywhere;
  }
  .circuit-name {
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .resume-card {
    border: 2px solid var(--color-accent);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    margin-bottom: 2rem;
  }
  .resume-card :global(.destructive-secondary) {
    margin-top: var(--space-lg);
  }
  .circuits {
    display: grid;
    gap: var(--space-lg);
  }
  .circuit-card {
    padding: var(--space-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .circuit-card button {
    width: 100%;
    min-height: 56px;
    font-weight: 700;
  }
</style>
