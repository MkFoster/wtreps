<script lang="ts">
  import { onMount } from 'svelte';
  import { beforeNavigate, goto } from '$app/navigation';
  import type { Circuit } from '#lib/domain/circuit.js';
  import type { Exercise } from '#lib/domain/exercise.js';
  import { MAX_EXERCISE_SETTINGS, newExerciseForm } from '#lib/domain/exerciseForm.js';
  import {
    createExercise,
    updateExercise,
    getExerciseDetails,
    deleteExercise,
    getExerciseCircuits,
  } from '#lib/data/repositories/exerciseRepository.js';
  import { getSettings } from '#lib/data/repositories/settingsRepository.js';
  import { ExerciseValidationError, validateExerciseInput } from '#lib/validation/exercise.js';
  import ConfirmDialog from './ConfirmDialog.svelte';

  let {
    exerciseId,
    onsaved,
    oncancel,
    onstatechange,
  }: {
    exerciseId?: string;
    onsaved?: (exercise: Exercise) => void;
    oncancel?: () => void;
    onstatechange?: (dirty: boolean, busy: boolean) => void;
  } = $props();
  let form = $state(newExerciseForm());
  let baseline = $state('');
  let exercise = $state<Exercise>();
  let status = $state<'loading' | 'ready' | 'missing' | 'error'>('loading');
  let defaultUnit = $state('lb');
  let busy = $state(false);
  let error = $state('');
  let deleteOpen = $state(false);
  let circuits = $state<Circuit[]>([]);
  let pendingNavigation = $state<string>();
  let cancelPending = $state(false);
  let allowNavigation = false;
  let nameInput = $state<HTMLInputElement>();
  let savedId: string | undefined;
  const dirty = $derived(status === 'ready' && JSON.stringify(form) !== baseline);

  $effect(() => {
    onstatechange?.(dirty, busy);
  });

  beforeNavigate((navigation) => {
    // The hosting Circuit editor protects both drafts during embedded creation.
    if (onsaved) return;
    if (allowNavigation || (!dirty && !busy)) return;
    if (navigation.to?.url.hash === '#main' && navigation.to.url.pathname === location.pathname)
      return;
    navigation.cancel();
    // For unload/reload, SvelteKit invokes the browser's native confirmation.
    if (!navigation.willUnload && navigation.to && !busy)
      pendingNavigation = navigation.to.url.href;
  });

  async function load() {
    status = 'loading';
    error = '';
    try {
      const [details, settings] = await Promise.all([
        exerciseId ? getExerciseDetails(exerciseId) : undefined,
        getSettings(),
      ]);
      defaultUnit = settings.weightUnit;
      if (exerciseId && !details) {
        status = 'missing';
        return;
      }
      if (details) {
        exercise = details.exercise;
        form = {
          name: exercise.name,
          notes: exercise.notes,
          weightUnitOverride: exercise.weightUnitOverride,
          settings: details.settings.map(({ id, position, label, value }) => ({
            id,
            position,
            label,
            value,
          })),
        };
      }
      baseline = JSON.stringify(form);
      status = 'ready';
    } catch (cause) {
      console.error('Exercise load failed', cause);
      status = 'error';
    }
  }

  onMount(() => {
    void load();
  });

  function addSetting() {
    if (form.settings.length >= MAX_EXERCISE_SETTINGS) return;
    const position = [1, 2, 3, 4, 5].find(
      (value) => !form.settings.some((row) => row.position === value),
    );
    if (position === undefined) return;
    form.settings = [...form.settings, { position, label: '', value: '' }].sort(
      (a, b) => a.position - b.position,
    );
  }

  async function returnToList(message: string) {
    allowNavigation = true;
    try {
      await goto('/exercises', { state: { exerciseFeedback: message } });
    } catch (cause) {
      allowNavigation = false;
      console.error('Return to exercise list failed', cause);
      error = 'Your change was saved. Use the Exercises link to return to the list.';
    }
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    error = '';
    try {
      validateExerciseInput(form);
    } catch (cause) {
      error =
        cause instanceof ExerciseValidationError ? cause.message : 'Check the exercise details.';
      if (!form.name.trim()) nameInput?.focus();
      return;
    }
    busy = true;
    try {
      const targetId = savedId ?? exerciseId;
      let savedExercise: Exercise;
      if (targetId) {
        await updateExercise(targetId, form);
        savedExercise = (await getExerciseDetails(targetId))!.exercise;
      } else {
        savedExercise = await createExercise(form);
        savedId = savedExercise.id;
      }
      baseline = JSON.stringify(form);
      if (onsaved) onsaved(savedExercise);
      else await returnToList('Exercise saved');
    } catch (cause) {
      console.error('Exercise save failed', cause);
      error =
        cause instanceof ExerciseValidationError
          ? cause.message
          : 'WtReps could not save this exercise. Your changes are still here. Please try again.';
    } finally {
      busy = false;
    }
  }

  async function requestDelete() {
    if (!exerciseId || busy) return;
    busy = true;
    error = '';
    try {
      circuits = await getExerciseCircuits(exerciseId);
      deleteOpen = true;
    } catch (cause) {
      console.error('Circuit lookup failed', cause);
      error = 'WtReps could not check where this exercise is used. Please try again.';
    } finally {
      busy = false;
    }
  }

  async function confirmDelete() {
    if (!exerciseId || busy) return;
    busy = true;
    error = '';
    try {
      await deleteExercise(exerciseId);
      baseline = JSON.stringify(form);
      deleteOpen = false;
      await returnToList('Exercise deleted');
    } catch (cause) {
      console.error('Exercise deletion failed', cause);
      deleteOpen = false;
      error = 'WtReps could not delete this exercise. Please try again.';
    } finally {
      busy = false;
    }
  }

  async function discard() {
    if (cancelPending) {
      cancelPending = false;
      oncancel?.();
      return;
    }
    const destination = pendingNavigation;
    pendingNavigation = undefined;
    if (!destination) return;
    allowNavigation = true;
    try {
      await goto(destination);
    } catch (cause) {
      allowNavigation = false;
      console.error('Navigation failed', cause);
      error = 'Could not leave this page. Please try again.';
    }
  }

  function cancelEmbedded() {
    if (busy) return;
    if (dirty) cancelPending = true;
    else oncancel?.();
  }
</script>

<svelte:head><title>{exerciseId ? 'Edit Exercise' : 'New Exercise'} · WtReps</title></svelte:head>
{#if oncancel}
  <button type="button" class="back-link secondary" disabled={busy} onclick={cancelEmbedded}
    >‹ Back to Circuit</button
  >
{:else}
  <a class="back-link" href="/exercises">‹ Exercises</a>
{/if}
<h1>{exerciseId ? 'Edit Exercise' : 'New Exercise'}</h1>

{#if status === 'loading'}
  <p role="status">Loading exercise…</p>
{:else if status === 'missing'}
  <p>This exercise is no longer available.</p>
  <a class="button-link" href="/exercises">Back to Exercises</a>
{:else if status === 'error'}
  <p role="alert">WtReps could not load this exercise. Please try again.</p>
  <button onclick={load}>Retry</button>
{:else}
  {#if error}<p class="error-banner" role="alert">{error}</p>{/if}
  <form onsubmit={save}>
    <fieldset class="form-fields" disabled={busy}>
      <div class="field">
        <label for="exercise-name">Exercise name</label>
        <input
          bind:this={nameInput}
          id="exercise-name"
          bind:value={form.name}
          required
          maxlength="100"
          autocomplete="off"
        />
      </div>
      <section aria-labelledby="machine-settings-title">
        <h2 id="machine-settings-title">Machine Settings</h2>
        <p class="storage-note">
          Save up to five settings. Rows need both a label and a value to be saved.
        </p>
        {#each form.settings as row (row.position)}
          <fieldset class="setting-row">
            <legend>Setting {row.position}</legend>
            <div class="field">
              <label for={`setting-label-${row.position}`}>Label</label>
              <input
                id={`setting-label-${row.position}`}
                bind:value={row.label}
                maxlength="50"
                autocomplete="off"
              />
            </div>
            <div class="field">
              <label for={`setting-value-${row.position}`}>Value</label>
              <input
                id={`setting-value-${row.position}`}
                bind:value={row.value}
                maxlength="100"
                type="text"
                autocomplete="off"
              />
            </div>
            <button
              type="button"
              class="secondary"
              aria-label={`Remove setting ${row.position}`}
              onclick={() => {
                form.settings = form.settings.filter(
                  (setting) => setting.position !== row.position,
                );
              }}>Remove</button
            >
          </fieldset>
        {/each}
        {#if form.settings.length < MAX_EXERCISE_SETTINGS}
          <button class="secondary" type="button" onclick={addSetting}>+ Setting</button>
        {:else}<p class="storage-note">Five-setting limit reached.</p>{/if}
      </section>
      <div class="field">
        <label for="exercise-notes">Notes <span class="storage-note">(optional)</span></label>
        <textarea id="exercise-notes" bind:value={form.notes} rows="4"></textarea>
      </div>
      <div class="field">
        <label for="weight-unit">Weight unit</label>
        <select id="weight-unit" bind:value={form.weightUnitOverride}>
          <option value={null}>Use default ({defaultUnit})</option>
          <option value="lb">Pounds</option>
          <option value="kg">Kilograms</option>
        </select>
      </div>
      <button class="save-button" type="submit">{busy ? 'Saving…' : 'Save Exercise'}</button>
      {#if oncancel}
        <button class="secondary" type="button" onclick={cancelEmbedded}>Cancel</button>
      {:else}<a class="cancel-link" href="/exercises">Cancel</a>{/if}
    </fieldset>
  </form>
  {#if exerciseId}
    <a class="back-link" href={`/exercises/${exerciseId}/history`}>View History</a>
    <div class="delete-section">
      <button class="destructive-secondary" disabled={busy} onclick={requestDelete}
        >Delete Exercise</button
      >
    </div>
  {/if}
{/if}

{#if pendingNavigation || cancelPending}
  <ConfirmDialog
    title="Discard changes?"
    confirmLabel="Discard"
    cancelLabel="Keep Editing"
    onconfirm={discard}
    oncancel={() => {
      pendingNavigation = undefined;
      cancelPending = false;
    }}
  >
    <p>Your unsaved changes will be lost.</p>
  </ConfirmDialog>
{/if}
{#if deleteOpen}
  <ConfirmDialog
    title={`Delete ${exercise?.name}?`}
    confirmLabel="Delete Exercise"
    destructive
    {busy}
    onconfirm={confirmDelete}
    oncancel={() => {
      deleteOpen = false;
    }}
  >
    {#if circuits.length}
      <p>This exercise is currently used in:</p>
      <ul>
        {#each circuits as circuit}<li>{circuit.name}</li>{/each}
      </ul>
      <p>Deleting it will remove it from those circuits.</p>
    {/if}
    <p>Historical workouts will not be changed.</p>
  </ConfirmDialog>
{/if}

<style>
  .form-fields {
    padding: 0;
    margin: 0;
    border: 0;
    display: grid;
    gap: 2rem;
    min-width: 0;
  }
  .setting-row {
    margin: 0 0 var(--space-lg);
    padding: var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    min-width: 0;
  }
  legend {
    font-weight: 600;
    padding-inline: var(--space-sm);
  }
  h2 {
    font-size: var(--font-size-large);
    margin: 0 0 var(--space-md);
  }
  .field {
    display: grid;
    gap: var(--space-sm);
  }
  .setting-row .field {
    margin-bottom: var(--space-md);
  }
  .save-button {
    width: 100%;
    min-height: 56px;
    font-weight: 700;
  }
  .cancel-link {
    min-height: var(--touch-target-min);
    text-align: center;
    padding: var(--space-sm);
  }
  .delete-section {
    margin-top: 3rem;
    padding-top: var(--space-lg);
    border-top: 1px solid var(--color-border);
  }
</style>
