<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { beforeNavigate, goto } from '$app/navigation';
  import type { Circuit } from '#lib/domain/circuit.js';
  import type { Exercise } from '#lib/domain/exercise.js';
  import { addCircuitExercise, moveCircuitExercise } from '#lib/domain/circuitForm.js';
  import {
    createCircuit,
    updateCircuit,
    getCircuitDetails,
    deleteCircuit,
    CircuitInUseError,
  } from '#lib/data/repositories/circuitRepository.js';
  import { CircuitValidationError, validateCircuitInput } from '#lib/validation/circuit.js';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import ExercisePicker from './ExercisePicker.svelte';
  import ExerciseEditor from './ExerciseEditor.svelte';

  let { circuitId }: { circuitId?: string } = $props();
  let form = $state<{ name: string; description: string; exercises: Exercise[] }>({
    name: '',
    description: '',
    exercises: [],
  });
  let circuit = $state<Circuit>();
  let status = $state<'loading' | 'ready' | 'missing' | 'error'>('loading');
  let mode = $state<'edit' | 'pick' | 'create'>('edit');
  let baseline = $state('');
  let busy = $state(false);
  let childBusy = $state(false);
  let childDirty = $state(false);
  let error = $state('');
  let message = $state('');
  let deleteOpen = $state(false);
  let pendingNavigation = $state<string>();
  let heading = $state<HTMLHeadingElement>();
  let nameInput = $state<HTMLInputElement>();
  let savedId: string | undefined;
  let allowNavigation = false;
  const dirty = $derived(status === 'ready' && JSON.stringify(form) !== baseline);
  const input = $derived({
    name: form.name,
    description: form.description,
    exerciseIds: form.exercises.map((exercise) => exercise.id),
  });

  beforeNavigate((navigation) => {
    if (allowNavigation || (!dirty && !childDirty && !busy && !childBusy)) return;
    if (navigation.to?.url.hash === '#main' && navigation.to.url.pathname === location.pathname)
      return;
    navigation.cancel();
    if (!navigation.willUnload && navigation.to && !busy && !childBusy)
      pendingNavigation = navigation.to.url.href;
  });

  async function load() {
    status = 'loading';
    try {
      if (circuitId) {
        const details = await getCircuitDetails(circuitId);
        if (!details) {
          status = 'missing';
          return;
        }
        circuit = details.circuit;
        form = {
          name: circuit.name,
          description: circuit.description,
          exercises: details.exercises,
        };
      }
      baseline = JSON.stringify(form);
      status = 'ready';
    } catch (cause) {
      console.error('Circuit load failed', cause);
      status = 'error';
    }
  }
  onMount(() => {
    void load();
  });

  async function returnToEditor() {
    mode = 'edit';
    childDirty = false;
    childBusy = false;
    await tick();
    heading?.focus();
    window.scrollTo({ top: 0 });
  }

  function selectExercise(exercise: Exercise) {
    form.exercises = addCircuitExercise(form.exercises, exercise);
    message = `${exercise.name} added`;
    void returnToEditor();
  }

  async function returnToList(feedback: string) {
    allowNavigation = true;
    try {
      await goto('/circuits', { state: { circuitFeedback: feedback } });
    } catch (cause) {
      allowNavigation = false;
      console.error('Circuit navigation failed', cause);
      error = 'Your change was saved. Use the Circuits link to return to the list.';
    }
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    error = '';
    try {
      validateCircuitInput(input);
    } catch (cause) {
      error =
        cause instanceof CircuitValidationError ? cause.message : 'Check the circuit details.';
      if (!form.name.trim()) nameInput?.focus();
      return;
    }
    busy = true;
    try {
      const targetId = savedId ?? circuitId;
      if (targetId) await updateCircuit(targetId, input);
      else savedId = (await createCircuit(input)).id;
      baseline = JSON.stringify(form);
      await returnToList('Circuit saved');
    } catch (cause) {
      console.error('Circuit save failed', cause);
      error =
        cause instanceof CircuitValidationError
          ? cause.message
          : 'WtReps could not save this circuit. Your changes are still here. Please try again.';
    } finally {
      busy = false;
    }
  }

  async function confirmDelete() {
    if (!circuitId || busy) return;
    busy = true;
    error = '';
    try {
      await deleteCircuit(circuitId);
      baseline = JSON.stringify(form);
      deleteOpen = false;
      await returnToList('Circuit deleted');
    } catch (cause) {
      console.error('Circuit deletion failed', cause);
      deleteOpen = false;
      error =
        cause instanceof CircuitInUseError
          ? cause.message
          : 'WtReps could not delete this circuit. Please try again.';
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
      allowNavigation = false;
      console.error('Circuit navigation failed', cause);
      error = 'Could not leave this page. Please try again.';
    }
  }
</script>

<svelte:head
  >{#if mode === 'edit'}<title>{circuitId ? 'Edit Circuit' : 'New Circuit'} · WtReps</title
    >{/if}</svelte:head
>

{#if status === 'ready' && mode === 'create'}
  <ExerciseEditor
    onsaved={selectExercise}
    oncancel={() => {
      childDirty = false;
      childBusy = false;
      mode = 'pick';
    }}
    onstatechange={(changed, saving) => {
      childDirty = changed;
      childBusy = saving;
    }}
  />
{:else if status === 'ready' && mode === 'pick'}
  <ExercisePicker
    excludedIds={input.exerciseIds}
    onselect={selectExercise}
    oncreate={() => {
      mode = 'create';
    }}
    oncancel={() => {
      void returnToEditor();
    }}
  />
{:else}
  <a class="back-link" href="/circuits">‹ Circuits</a>
  <h1 bind:this={heading} tabindex="-1">{circuitId ? 'Edit Circuit' : 'New Circuit'}</h1>
  {#if status === 'loading'}
    <p role="status">Loading circuit…</p>
  {:else if status === 'missing'}
    <p>This circuit is no longer available.</p>
  {:else if status === 'error'}
    <p role="alert">WtReps could not load this circuit.</p>
    <button onclick={load}>Retry</button>
  {:else}
    {#if error}<p class="error-banner" role="alert">{error}</p>{/if}
    {#if message}<p class="success-message" role="status">{message}</p>{/if}
    <form onsubmit={save}>
      <fieldset class="form-fields" disabled={busy}>
        <div class="field">
          <label for="circuit-name">Circuit name</label><input
            bind:this={nameInput}
            id="circuit-name"
            bind:value={form.name}
            required
            maxlength="100"
            autocomplete="off"
          />
        </div>
        <div class="field">
          <label for="circuit-description"
            >Description <span class="storage-note">(optional)</span></label
          ><textarea id="circuit-description" bind:value={form.description} rows="3"></textarea>
        </div>
        <section aria-labelledby="circuit-exercises-title">
          <h2 id="circuit-exercises-title">Exercises</h2>
          {#if form.exercises.length}
            <ol class="ordered-exercises" aria-label="Circuit exercise order">
              {#each form.exercises as exercise, index (exercise.id)}
                <li>
                  <strong>{index + 1}. {exercise.name}</strong>
                  <div class="row-actions">
                    <button
                      type="button"
                      class="secondary"
                      aria-label={`Move ${exercise.name} up`}
                      disabled={index === 0}
                      onclick={() => {
                        form.exercises = moveCircuitExercise(form.exercises, index, -1);
                      }}>Move Up</button
                    >
                    <button
                      type="button"
                      class="secondary"
                      aria-label={`Move ${exercise.name} down`}
                      disabled={index === form.exercises.length - 1}
                      onclick={() => {
                        form.exercises = moveCircuitExercise(form.exercises, index, 1);
                      }}>Move Down</button
                    >
                    <button
                      type="button"
                      class="secondary"
                      aria-label={`Remove ${exercise.name}`}
                      onclick={() => {
                        form.exercises = form.exercises.filter((row) => row.id !== exercise.id);
                        message = `${exercise.name} removed from this circuit`;
                      }}>Remove</button
                    >
                  </div>
                </li>
              {/each}
            </ol>
          {:else}<p>No exercises yet.</p>
            <p>
              Add exercises in the order you perform them. You can also save an empty circuit.
            </p>{/if}
          <button
            class="secondary"
            type="button"
            onclick={() => {
              mode = 'pick';
              error = '';
              message = '';
            }}>+ Add Exercise</button
          >
        </section>
        <button class="save-button" type="submit">{busy ? 'Saving…' : 'Save Circuit'}</button>
        <a class="cancel-link" href="/circuits">Cancel</a>
      </fieldset>
    </form>
    {#if circuitId}
      <div class="delete-section">
        <button
          class="destructive-secondary"
          disabled={busy}
          onclick={() => {
            deleteOpen = true;
          }}>Delete Circuit</button
        >
      </div>
    {/if}
  {/if}
{/if}

{#if pendingNavigation}
  <ConfirmDialog
    title="Discard changes?"
    confirmLabel="Discard"
    cancelLabel="Keep Editing"
    onconfirm={discard}
    oncancel={() => {
      pendingNavigation = undefined;
    }}><p>Your unsaved changes will be lost.</p></ConfirmDialog
  >
{/if}
{#if deleteOpen}
  <ConfirmDialog
    title={`Delete ${circuit?.name}?`}
    confirmLabel="Delete Circuit"
    destructive
    {busy}
    onconfirm={confirmDelete}
    oncancel={() => {
      deleteOpen = false;
    }}
  >
    <p>This removes the circuit from your current workout options.</p>
    <p>Historical workouts using this circuit will be preserved.</p>
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
  .field {
    display: grid;
    gap: var(--space-sm);
  }
  h2 {
    font-size: var(--font-size-large);
    margin: 0 0 var(--space-md);
  }
  .ordered-exercises {
    padding: 0;
    list-style: none;
  }
  li {
    padding-block: var(--space-lg);
    border-bottom: 1px solid var(--color-border);
  }
  strong {
    display: block;
    overflow-wrap: anywhere;
    margin-bottom: var(--space-md);
    font-size: 1.25rem;
  }
  .row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
  .row-actions button {
    flex: 1 1 120px;
    padding-inline: var(--space-sm);
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
