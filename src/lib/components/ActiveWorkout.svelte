<script lang="ts">
  import { beforeNavigate, goto } from '$app/navigation';
  import { tick } from 'svelte';
  import {
    observeWorkoutEntry,
    type WorkoutEntry,
  } from '#lib/data/repositories/workoutRepository.js';
  import { addSet, moveCurrentExercise, prepareWorkoutEntry } from '#lib/services/workoutEntry.js';
  import { completeWorkout } from '#lib/services/completeWorkout.js';
  import { WorkoutActionError } from '#lib/domain/workout.js';
  import WorkoutSetCard from './WorkoutSetCard.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import AbandonWorkoutButton from './AbandonWorkoutButton.svelte';
  let { workoutId }: { workoutId: string } = $props();
  let data = $state<WorkoutEntry>();
  let status = $state<'loading' | 'ready' | 'missing' | 'error'>('loading');
  let error = $state('');
  let busy = $state(false);
  let ending = $state(false);
  let retry = $state(0);
  let allowNavigation = false;
  const flushers = new Map<string, (discardIncomplete?: boolean) => Promise<void>>();
  const currentIndex = $derived(
    data?.exercises.findIndex((row) => row.id === data?.current?.id) ?? 0,
  );
  function register(id: string, flush?: (discardIncomplete?: boolean) => Promise<void>) {
    if (flush) flushers.set(id, flush);
    else flushers.delete(id);
  }
  async function flush(discardIncomplete = false) {
    for (const save of flushers.values()) await save(discardIncomplete);
  }
  function fail(cause: unknown) {
    console.error('Workout action failed', cause);
    error =
      cause instanceof WorkoutActionError
        ? cause.message
        : 'WtReps could not save this change. Your workout may not be fully saved. Please retry.';
  }
  $effect(() => {
    void retry;
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;
    status = 'loading';
    void prepareWorkoutEntry(workoutId)
      .then(() => {
        if (cancelled) return;
        subscription = observeWorkoutEntry(workoutId).subscribe({
          next: (value) => {
            data = value;
            status = value ? 'ready' : 'missing';
          },
          error: (cause: unknown) => {
            fail(cause);
            status = 'error';
          },
        });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          fail(cause);
          status = 'error';
        }
      });
    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  });
  beforeNavigate((navigation) => {
    if (allowNavigation || data?.workout.status !== 'in_progress' || navigation.willUnload) return;
    const destination = navigation.to?.url;
    if (!destination) return;
    navigation.cancel();
    void action(async () => {
      await flush();
      allowNavigation = true;
      try {
        await goto(destination);
      } finally {
        allowNavigation = false;
      }
    });
  });
  async function action(operation: () => Promise<void>) {
    if (busy) return;
    busy = true;
    error = '';
    try {
      await operation();
    } catch (cause) {
      fail(cause);
    } finally {
      busy = false;
    }
  }
  async function move(index: number) {
    if (!data?.exercises[index]) return;
    const position = data.exercises[index]!.position;
    await action(async () => {
      await flush();
      await moveCurrentExercise(workoutId, position);
      await tick();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }
  async function end() {
    await action(async () => {
      await flush(true);
      await completeWorkout(workoutId);
      ending = false;
      allowNavigation = true;
      try {
        await goto(`/workout/${workoutId}/summary`);
      } finally {
        allowNavigation = false;
      }
    });
  }
</script>

<svelte:head><title>{data?.workout.circuitName ?? 'Workout'} · WtReps</title></svelte:head>
<a class="back-link" href="/">‹ Home</a>
{#if status === 'loading'}<p role="status">Loading workout…</p>
{:else if status === 'error'}<h1>Workout unavailable</h1>
  <p class="error-banner" role="alert">{error}</p>
  <button
    onclick={() => {
      retry += 1;
    }}>Retry</button
  >
{:else if status === 'missing'}<h1>Workout unavailable</h1>
  <p>This workout is no longer available on this device.</p>
{:else if data}
  {#if error && !ending}<p class="error-banner" role="alert">{error}</p>{/if}
  <p class="status" role="status">
    {data.workout.status === 'in_progress'
      ? 'Workout in progress'
      : data.workout.status === 'completed'
        ? 'Workout completed'
        : 'Workout abandoned'}
  </p>
  <div class="workout-header">
    <strong>{currentIndex + 1} of {data.exercises.length}</strong><span
      >{data.workout.circuitName}</span
    >
  </div>
  {#if data.current}
    <h1>{data.current.exerciseName}</h1>
    {#if data.settings.length}<section class="machine-settings" aria-label="Machine Settings">
        <h2>Machine Settings</h2>
        <dl>
          {#each data.settings as setting (setting.id)}<div>
              <dt>{setting.label}</dt>
              <dd>{setting.value}</dd>
            </div>{/each}
        </dl>
      </section>{/if}
    {#if data.current.exerciseNotes}<p class="notes">{data.current.exerciseNotes}</p>{/if}
    {#if data.workout.status === 'in_progress'}
      <section aria-label="Last Time">
        <h2>Last Time</h2>
        {#if data.previous}{#each data.previous.sets as set (set.id)}<p class="previous-set">
              {set.weight}
              {data.previous.exercise.weightUnit} × {set.reps}
            </p>{/each}{:else}<p>No previous sets</p>{/if}
      </section>
      <h2>Today</h2>
      {#key data.current.id}{#each data.sets as set (set.id)}<WorkoutSetCard
            {set}
            unit={data.current.weightUnit}
            {register}
          />{/each}{/key}
      <button
        class="add-set"
        disabled={busy}
        onclick={() => {
          void action(async () => {
            await flush();
            await addSet(data!.current!.id);
          });
        }}>+ Set</button
      >
      <footer aria-label="Exercise navigation">
        <div class="directions">
          <button
            class="secondary"
            disabled={busy || currentIndex === 0}
            onclick={() => {
              void move(currentIndex - 1);
            }}>‹ Previous</button
          >
          {#if currentIndex === data.exercises.length - 1}<button
              disabled={busy}
              onclick={() => {
                ending = true;
              }}>Finish</button
            >{:else}<button
              disabled={busy}
              onclick={() => {
                void move(currentIndex + 1);
              }}>Next ›</button
            >{/if}
        </div>
        <button
          class="end"
          disabled={busy}
          onclick={() => {
            ending = true;
          }}>End Workout</button
        >
      </footer>
      <AbandonWorkoutButton
        {workoutId}
        onabandoned={() => {
          allowNavigation = true;
          void goto('/')
            .catch(fail)
            .finally(() => {
              allowNavigation = false;
            });
        }}
      />
    {:else}
      {#each data.sets.filter((set) => set.isCompleted) as set (set.id)}<p>
          {set.weight}
          {data.current.weightUnit} × {set.reps} reps
        </p>{/each}
      {#if data.workout.status === 'completed'}<a
          class="button-link"
          href={`/workout/${workoutId}/summary`}>Workout Summary</a
        >{/if}
    {/if}
  {:else}<h1>No exercises in this workout</h1>{/if}
{/if}
{#if ending}<ConfirmDialog
    title="End Workout?"
    confirmLabel="End Workout"
    cancelLabel="Keep Working"
    {busy}
    oncancel={() => {
      ending = false;
    }}
    onconfirm={() => {
      void end();
    }}
    ><p>
      Your completed sets will be saved.<br />Incomplete sets will be discarded.
    </p>
    {#if error}<p class="error-banner" role="alert">{error}</p>{/if}</ConfirmDialog
  >{/if}

<style>
  .status {
    color: var(--color-muted);
    margin-bottom: var(--space-sm);
  }
  .workout-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }
  .workout-header strong {
    font-size: var(--font-size-large);
    white-space: nowrap;
  }
  .workout-header span,
  h1,
  .notes {
    overflow-wrap: anywhere;
  }
  h2 {
    font-size: var(--font-size-body);
    margin: 0 0 var(--space-sm);
  }
  section {
    margin-bottom: var(--space-lg);
  }
  .machine-settings {
    padding: var(--space-md);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
  }
  dl {
    margin: 0;
  }
  dl div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-md);
    align-items: baseline;
  }
  dt,
  dd {
    overflow-wrap: anywhere;
  }
  dd {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 700;
  }
  .previous-set {
    margin: 0;
    font-size: var(--font-size-large);
  }
  .add-set {
    width: 100%;
    min-height: 56px;
    margin-bottom: var(--space-lg);
  }
  footer {
    position: sticky;
    bottom: 0;
    padding: var(--space-sm) 0 max(var(--space-sm), env(safe-area-inset-bottom));
    background: var(--color-background);
    z-index: 1;
    border-top: 1px solid var(--color-border);
  }
  .directions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-sm);
  }
  .directions button {
    min-height: 56px;
    padding-inline: var(--space-sm);
  }
  .end {
    width: 100%;
    background: transparent;
    color: var(--color-accent);
    text-decoration: underline;
  }
</style>
