<script lang="ts">
  import { abandonWorkout } from '#lib/services/abandonWorkout.js';
  import { WorkoutActionError } from '#lib/domain/workout.js';
  import ConfirmDialog from './ConfirmDialog.svelte';

  let {
    workoutId,
    label = 'Abandon Workout',
    onabandoned,
  }: {
    workoutId: string;
    label?: string;
    onabandoned?: () => void;
  } = $props();
  let open = $state(false);
  let busy = $state(false);
  let error = $state('');

  async function confirm() {
    if (busy) return;
    busy = true;
    error = '';
    try {
      await abandonWorkout(workoutId);
      open = false;
      onabandoned?.();
    } catch (cause) {
      console.error('Workout abandonment failed', cause);
      open = false;
      error =
        cause instanceof WorkoutActionError
          ? cause.message
          : 'WtReps could not abandon this workout. Please try again.';
    } finally {
      busy = false;
    }
  }
</script>

{#if error}<p class="error-banner" role="alert">{error}</p>{/if}
<button
  class="destructive-secondary"
  disabled={busy}
  onclick={() => {
    open = true;
  }}>{label}</button
>
{#if open}
  <ConfirmDialog
    title="Abandon Workout?"
    confirmLabel="Abandon Workout"
    cancelLabel="Keep Workout"
    destructive
    {busy}
    onconfirm={confirm}
    oncancel={() => {
      open = false;
    }}
  >
    <p>Completed sets from this workout will not appear in normal workout history.</p>
  </ConfirmDialog>
{/if}
