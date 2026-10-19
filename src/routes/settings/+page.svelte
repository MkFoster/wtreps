<script lang="ts">
  import { onMount } from 'svelte';
  import { version } from '../../../package.json';
  import type { AppSettings } from '#lib/domain/settings.js';
  import { observeSettings, updateWeightUnit } from '#lib/data/repositories/settingsRepository.js';
  import {
    getStoragePersistence,
    requestStoragePersistence,
    type StorageState,
  } from '#lib/services/storagePersistence.js';
  import BackupControls from '#lib/components/BackupControls.svelte';
  let settings = $state<AppSettings>();
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let retry = $state(0);
  let busy = $state(false);
  let error = $state('');
  let storage = $state<StorageState>();
  let storageBusy = $state(false);
  let storageRequested = $state(false);
  $effect(() => {
    void retry;
    status = 'loading';
    const subscription = observeSettings().subscribe({
      next: (value) => {
        settings = value;
        status = 'ready';
      },
      error: (cause: unknown) => {
        console.error('Settings load failed', cause);
        status = 'error';
      },
    });
    return () => subscription.unsubscribe();
  });
  onMount(() => {
    void getStoragePersistence().then((value) => {
      storage = value;
    });
  });
  async function changeUnit(event: Event) {
    const input = event.currentTarget as HTMLSelectElement;
    const previous = settings!.weightUnit;
    const unit = input.value;
    if (unit !== 'lb' && unit !== 'kg') return;
    busy = true;
    error = '';
    try {
      await updateWeightUnit(unit);
    } catch (cause) {
      console.error('Weight preference failed', cause);
      input.value = previous;
      error = 'WtReps could not save this preference. Please try again.';
    } finally {
      busy = false;
    }
  }
  async function persist() {
    storageBusy = true;
    storageRequested = true;
    try {
      storage = await requestStoragePersistence();
    } finally {
      storageBusy = false;
    }
  }
</script>

<svelte:head><title>Settings · WtReps</title></svelte:head>
<h1>Settings</h1>
{#if status === 'loading'}<p role="status">Loading settings…</p>
{:else if status === 'error'}<p role="alert">WtReps could not load your settings.</p>
  <button
    onclick={() => {
      retry += 1;
    }}>Retry</button
  >
{:else if settings}
  <section aria-labelledby="workout-heading">
    <h2 id="workout-heading">Workout</h2>
    {#if error}<p class="error-banner" role="alert">{error}</p>{/if}
    <label for="default-unit">Default weight unit</label>
    <select
      id="default-unit"
      value={settings.weightUnit}
      disabled={busy}
      onchange={(event) => {
        void changeUnit(event);
      }}><option value="lb">Pounds (lb)</option><option value="kg">Kilograms (kg)</option></select
    >
    <p class="storage-note">Used for future workouts unless an exercise has its own unit.</p>
  </section>
  <BackupControls lastExportAt={settings.lastExportAt} />
  <section aria-labelledby="storage-heading">
    <h2 id="storage-heading">Storage</h2>
    <p>
      WtReps stores your data on this device. Persistent storage helps reduce the chance that the
      browser removes local data automatically.
    </p>
    {#if storage}<p>
        Persistent storage: {storage.status === 'enabled'
          ? 'Enabled'
          : storage.status === 'unsupported'
            ? 'Not supported'
            : 'Not enabled'}
      </p>
      {#if storage.unavailable}<p class="storage-note">
          Storage protection could not be checked right now. You can keep using WtReps and exporting
          backups.
        </p>{/if}
      {#if storage.status === 'not_enabled'}<button
          class="secondary"
          disabled={storageBusy || storageRequested}
          onclick={() => {
            void persist();
          }}>Request Persistent Storage</button
        >
        {#if storageRequested && !storageBusy && !storage.unavailable}<p class="storage-note">
            The browser has not enabled persistent storage. Backups still protect your data.
          </p>{/if}
      {/if}
    {:else}<p class="storage-note">Checking storage…</p>{/if}
  </section>
  <section aria-labelledby="about-heading">
    <h2 id="about-heading">About</h2>
    <p><strong>WtReps</strong><br />Version {version}<br />Local-first workout tracking</p>
  </section>
{/if}

<style>
  section,
  :global(main > section:has(#backup-heading)) {
    margin-block: 2rem;
    padding-top: var(--space-lg);
    border-top: 1px solid var(--color-border);
  }
  h2 {
    font-size: var(--font-size-large);
    margin-top: 0;
  }
  select {
    margin-block: var(--space-sm) var(--space-md);
  }
  button {
    min-height: 56px;
  }
  :global(main > section:has(#backup-heading)) {
    margin-bottom: 2rem;
  }
</style>
