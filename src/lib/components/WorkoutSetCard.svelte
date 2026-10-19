<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { WeightUnit } from '#lib/domain/common.js';
  import { WorkoutActionError, type WorkoutSet } from '#lib/domain/workout.js';
  import {
    completeSet,
    deleteSet,
    updateSetValues,
    validateSetValues,
    type SetValues,
  } from '#lib/services/workoutEntry.js';
  let {
    set,
    unit,
    register,
  }: {
    set: WorkoutSet;
    unit: WeightUnit;
    register: (id: string, flush?: (discardIncomplete?: boolean) => Promise<void>) => void;
  } = $props();
  let weight = $state(untrack(() => set.weight?.toString() ?? ''));
  let reps = $state(untrack(() => set.reps?.toString() ?? ''));
  let editing = $state(false);
  let error = $state('');
  let busy = $state(false);
  let queue = Promise.resolve();
  function values(): SetValues {
    const weightValue = weight.trim() === '' ? null : Number(weight);
    const repsValue = reps.trim() === '' ? null : Number(reps);
    if ((weight && !/^\d*(?:\.\d*)?$/.test(weight)) || (reps && !/^\d+$/.test(reps)))
      throw new WorkoutActionError('Use a positive number for weight and whole-number reps.');
    const result = { weight: weightValue, reps: repsValue };
    validateSetValues(result, set.isCompleted);
    return result;
  }
  function message(cause: unknown) {
    console.error('Set save failed', cause);
    error =
      cause instanceof WorkoutActionError
        ? cause.message
        : 'WtReps could not save this change. Please retry before leaving.';
  }
  function saveInput() {
    try {
      const input = values();
      const id = set.id;
      queue = queue
        .catch(() => {})
        .then(async () => {
          await updateSetValues(id, input);
        });
      void queue.then(() => {
        error = '';
      }, message);
    } catch (cause) {
      message(cause);
    }
  }
  async function flush(discardIncomplete = false) {
    if (discardIncomplete && !set.isCompleted) {
      await queue.catch(() => {});
      return;
    }
    const input = values();
    await queue.catch(() => {});
    await updateSetValues(set.id, input);
    error = '';
  }
  onMount(() => {
    const id = set.id;
    register(id, flush);
    return () => register(id);
  });
  async function finish() {
    busy = true;
    try {
      await flush();
      await completeSet(set.id, values());
      editing = false;
    } catch (cause) {
      message(cause);
    } finally {
      busy = false;
    }
  }
  async function doneEditing() {
    busy = true;
    try {
      await flush();
      editing = false;
    } catch (cause) {
      message(cause);
    } finally {
      busy = false;
    }
  }
  async function remove() {
    busy = true;
    try {
      await queue.catch(() => {});
      await deleteSet(set.id);
    } catch (cause) {
      message(cause);
      busy = false;
    }
  }
</script>

<section class="set-card" class:completed={set.isCompleted} aria-label={`Set ${set.position}`}>
  <h3>{set.isCompleted ? '✓ ' : ''}Set {set.position}</h3>
  {#if set.isCompleted && !editing}
    <p class="result">{set.weight} {unit} × {set.reps} reps</p>
    <button
      class="secondary"
      onclick={() => {
        weight = set.weight?.toString() ?? '';
        reps = set.reps?.toString() ?? '';
        editing = true;
      }}>Edit</button
    >
  {:else}
    <div class="numbers">
      <label
        >Weight <span class="unit">({unit})</span><input
          aria-label="Weight"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          value={weight}
          oninput={(event) => {
            weight = event.currentTarget.value;
            saveInput();
          }}
        /></label
      >
      <label
        >Reps<input
          aria-label="Reps"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          value={reps}
          oninput={(event) => {
            reps = event.currentTarget.value;
            saveInput();
          }}
        /></label
      >
    </div>
    {#if set.isCompleted}<button class="primary" disabled={busy} onclick={doneEditing}
        >Done Editing</button
      >
    {:else}<button class="primary" disabled={busy} onclick={finish}>✓ Complete Set</button>{/if}
  {/if}
  {#if error}<p class="error-banner" role="alert">{error}</p>
    <button
      class="secondary"
      onclick={() => {
        void flush().catch(message);
      }}>Retry</button
    >{/if}
  <button class="remove" disabled={busy} onclick={remove}>Delete Set {set.position}</button>
</section>

<style>
  .set-card {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    margin-bottom: var(--space-md);
    background: var(--color-surface);
  }
  .completed {
    background: var(--color-accent-soft);
  }
  h3 {
    margin: 0 0 var(--space-sm);
    font-size: var(--font-size-body);
  }
  .numbers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }
  label {
    min-width: 0;
  }
  input {
    font-size: var(--font-size-workout-number);
    padding: var(--space-sm);
    min-width: 0;
    scroll-margin-block: 10rem;
  }
  .unit {
    font-weight: 400;
  }
  .primary {
    width: 100%;
    min-height: 56px;
  }
  .result {
    font-size: 1.625rem;
    font-weight: 700;
    margin-bottom: var(--space-sm);
    overflow-wrap: anywhere;
  }
  .remove {
    background: transparent;
    color: var(--color-muted);
    display: block;
    margin-top: var(--space-sm);
    padding: var(--space-sm);
    text-decoration: underline;
  }
  .error-banner {
    margin-top: var(--space-md);
  }
</style>
