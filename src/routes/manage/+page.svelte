<script lang="ts">
  import { observeManageCounts } from '#lib/data/repositories/manageRepository.js';
  let counts = $state<{ exercises: number; circuits: number }>();
  let failed = $state(false);
  let retry = $state(0);
  $effect(() => {
    void retry;
    failed = false;
    counts = undefined;
    const subscription = observeManageCounts().subscribe({
      next: (value) => {
        counts = value;
      },
      error: (cause: unknown) => {
        console.error('Manage counts failed', cause);
        failed = true;
      },
    });
    return () => subscription.unsubscribe();
  });
</script>

<svelte:head><title>Manage · WtReps</title></svelte:head>
<h1>Manage</h1>
<p>Set up your exercises, machine settings, and circuits.</p>
{#if failed}<p role="alert">WtReps could not load the counts.</p>
  <button
    onclick={() => {
      retry += 1;
    }}>Retry</button
  >
{:else if !counts}<p role="status">Loading…</p>{/if}
<section aria-labelledby="manage-exercises-title">
  <h2 id="manage-exercises-title">Exercises</h2>
  {#if counts}<p>{counts.exercises} {counts.exercises === 1 ? 'exercise' : 'exercises'}</p>{/if}
  <a class="button-link" href="/exercises">Manage Exercises ›</a>
</section>
<section aria-labelledby="manage-circuits-title">
  <h2 id="manage-circuits-title">Circuits</h2>
  {#if counts}<p>{counts.circuits} {counts.circuits === 1 ? 'circuit' : 'circuits'}</p>{/if}
  <a class="button-link" href="/circuits">Manage Circuits ›</a>
</section>

<style>
  section {
    margin-bottom: 2rem;
  }
  h2 {
    font-size: var(--font-size-large);
    margin-bottom: var(--space-sm);
  }
</style>
