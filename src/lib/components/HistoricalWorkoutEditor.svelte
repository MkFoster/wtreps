<script lang="ts">
  import { onMount } from 'svelte';
  import { beforeNavigate, goto } from '$app/navigation';
  import {
    getHistoricalWorkout,
    type HistoricalWorkout,
  } from '#lib/data/repositories/historyRepository.js';
  import {
    createHistoryDraft,
    newHistoricalSet,
    type HistoricalWorkoutDraft,
  } from '#lib/domain/historyForm.js';
  import { saveHistoricalWorkout } from '#lib/services/historicalWorkout.js';
  import { WorkoutActionError } from '#lib/domain/workout.js';
  import ConfirmDialog from './ConfirmDialog.svelte';
  let { workoutId }: { workoutId: string } = $props();
  let detail = $state<HistoricalWorkout>();
  let form = $state<HistoricalWorkoutDraft>({ updatedAt: '', exercises: [] });
  let baseline = $state('');
  let status = $state<'loading' | 'ready' | 'missing' | 'error'>('loading');
  let busy = $state(false);
  let error = $state('');
  let pendingNavigation = $state<string>();
  let allowNavigation = false;
  const dirty = $derived(status === 'ready' && JSON.stringify(form) !== baseline);
  beforeNavigate((navigation) => {
    if (allowNavigation || (!dirty && !busy)) return;
    if (navigation.to?.url.hash === '#main' && navigation.to.url.pathname === location.pathname)
      return;
    navigation.cancel();
    if (!navigation.willUnload && navigation.to && !busy)
      pendingNavigation = navigation.to.url.href;
  });
  async function load() {
    status = 'loading';
    try {
      detail = await getHistoricalWorkout(workoutId);
      if (!detail) {
        status = 'missing';
        return;
      }
      form = createHistoryDraft(detail);
      baseline = JSON.stringify(form);
      status = 'ready';
    } catch (cause) {
      console.error('History edit load failed', cause);
      status = 'error';
    }
  }
  onMount(() => {
    void load();
  });
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    error = '';
    try {
      await saveHistoricalWorkout(workoutId, form);
      baseline = JSON.stringify(form);
      allowNavigation = true;
      try {
        await goto(`/history/${workoutId}`, { state: { workoutFeedback: 'Workout updated' } });
      } catch (cause) {
        console.error('Saved workout navigation failed', cause);
        error = 'Your workout was saved. Use Cancel to return to the detail.';
        allowNavigation = false;
      }
    } catch (cause) {
      console.error('History edit save failed', cause);
      error =
        cause instanceof WorkoutActionError
          ? cause.message
          : 'WtReps could not save this workout. Your changes are still here. Please try again.';
    } finally {
      busy = false;
    }
  }
  async function discard() {
    const destination = pendingNavigation;
    pendingNavigation = undefined;
    if (!destination) return;
    allowNavigation = true;
    try {
      await goto(destination);
    } catch (cause) {
      console.error('History edit navigation failed', cause);
      error = 'Could not leave this page. Please try again.';
      allowNavigation = false;
    }
  }
</script>

<svelte:head><title>Edit Workout · WtReps</title></svelte:head>
<a class="back-link" href={`/history/${workoutId}`}>‹ Workout</a>
<h1>Edit Workout</h1>
{#if status === 'loading'}<p role="status">Loading workout…</p>
{:else if status === 'missing'}<p>This completed workout is no longer available.</p>
{:else if status === 'error'}<p role="alert">WtReps could not load this workout.</p>
  <button onclick={load}>Retry</button>
{:else if detail}
  <p class="circuit-name">{detail.workout.circuitName}</p>
  {#if error}<p class="error-banner" role="alert">{error}</p>{/if}
  <form onsubmit={save} novalidate>
    <fieldset class="editor" disabled={busy}>
      {#each form.exercises as row (row.id)}
        {@const source = detail.exercises.find((entry) => entry.exercise.id === row.id)!}
        <section aria-label={source.exercise.exerciseName}>
          <h2>{source.exercise.exerciseName}</h2>
          {#if row.settings.length}<h3>Machine Settings</h3>{/if}
          {#each row.settings as setting (setting.id)}
            {@const label = source.settings.find((entry) => entry.id === setting.id)!.label}
            <label for={`history-setting-${setting.id}`}>{label}</label><input
              id={`history-setting-${setting.id}`}
              type="text"
              maxlength="100"
              bind:value={setting.value}
            />
          {/each}
          <h3>Sets ({source.exercise.weightUnit})</h3>
          {#each row.sets as set, index (set.key)}
            <fieldset class="set-fields">
              <legend>Set {index + 1}</legend>
              <div class="numbers">
                <label
                  >Weight ({source.exercise.weightUnit})<input
                    aria-label="Weight"
                    type="text"
                    inputmode="decimal"
                    autocomplete="off"
                    bind:value={set.weight}
                  /></label
                ><label
                  >Reps<input
                    aria-label="Reps"
                    type="text"
                    inputmode="numeric"
                    autocomplete="off"
                    bind:value={set.reps}
                  /></label
                >
              </div>
              <button
                class="secondary"
                type="button"
                onclick={() => {
                  row.sets = row.sets.filter((entry) => entry.key !== set.key);
                }}>Remove Set {index + 1}</button
              >
            </fieldset>
          {:else}<p>No sets recorded. Add a set to correct this exercise.</p>{/each}
          <button
            class="secondary"
            type="button"
            onclick={() => {
              row.sets = [...row.sets, newHistoricalSet(row.sets)];
            }}>+ Set</button
          >
        </section>
      {/each}
      <button class="save" type="submit">{busy ? 'Saving…' : 'Save Workout'}</button>
      <a class="cancel" href={`/history/${workoutId}`}>Cancel</a>
    </fieldset>
  </form>
{/if}
{#if pendingNavigation}<ConfirmDialog
    title="Discard changes?"
    confirmLabel="Discard"
    cancelLabel="Keep Editing"
    onconfirm={() => {
      void discard();
    }}
    oncancel={() => {
      pendingNavigation = undefined;
    }}><p>Your unsaved changes will be lost.</p></ConfirmDialog
  >{/if}

<style>
  .editor {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
    display: grid;
    gap: var(--space-lg);
  }
  section {
    border-top: 1px solid var(--color-border);
    padding-block: var(--space-lg);
  }
  h2 {
    font-size: var(--font-size-large);
    overflow-wrap: anywhere;
    margin: 0 0 var(--space-md);
  }
  h3 {
    font-size: var(--font-size-body);
    margin-block: var(--space-lg) var(--space-md);
  }
  .circuit-name {
    font-weight: 700;
    overflow-wrap: anywhere;
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
    margin-block: var(--space-sm) var(--space-md);
  }
  .numbers input {
    font-size: 1.75rem;
    padding: var(--space-sm);
  }
  .set-fields {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    margin: 0 0 var(--space-md);
    min-width: 0;
  }
  .save {
    width: 100%;
    min-height: 56px;
  }
  .cancel {
    text-align: center;
    min-height: 48px;
    padding: var(--space-sm);
  }
</style>
