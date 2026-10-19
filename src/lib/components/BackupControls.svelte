<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { exportBackup } from '#lib/services/exportData.js';
  import { importData, readBackupFile } from '#lib/services/importData.js';
  import { BackupValidationError, type Backup } from '#lib/validation/exportSchema.js';
  import { workoutDate } from '#lib/utils/historyDisplay.js';
  import ConfirmDialog from './ConfirmDialog.svelte';
  let { lastExportAt }: { lastExportAt: string | null } = $props();
  let busy = $state(false);
  let pending = $state<Backup>();
  let error = $state('');
  let message = $state('');
  let fileInput: HTMLInputElement;
  beforeNavigate((navigation) => {
    if (busy) navigation.cancel();
  });
  async function download() {
    if (busy) return;
    busy = true;
    error = '';
    message = '';
    try {
      await exportBackup();
      message = 'Backup exported';
    } catch (cause) {
      console.error('Backup export failed', cause);
      error = 'Could not export backup.';
    } finally {
      busy = false;
    }
  }
  async function selectFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || busy) return;
    busy = true;
    error = '';
    message = '';
    pending = undefined;
    try {
      pending = await readBackupFile(file);
    } catch (cause) {
      console.error('Backup validation failed', cause);
      error = `Could not import backup. ${cause instanceof BackupValidationError ? cause.message : 'This file could not be read.'} Your current data was not changed.`;
    } finally {
      busy = false;
    }
  }
  async function replace() {
    if (!pending || busy) return;
    busy = true;
    error = '';
    message = '';
    try {
      await importData(pending);
      pending = undefined;
      message = 'Backup restored';
      // Repository live queries reload from the newly committed database. There
      // is no persistent in-memory state or preference cache to merge/reset.
    } catch (cause) {
      console.error('Backup replacement failed', cause);
      error = 'Could not import backup. Your current data was not changed.';
    } finally {
      busy = false;
    }
  }
</script>

<section aria-labelledby="backup-heading">
  <h2 id="backup-heading">Data &amp; Backup</h2>
  <h3>Local data only</h3>
  <p>
    Your WtReps data is stored on this device. Export a backup periodically to protect your workout
    history.
  </p>
  <p>{lastExportAt ? `Last backup: ${workoutDate(lastExportAt)}` : 'No backup created yet'}</p>
  {#if message}<p class="success-message" role="status">{message}</p>{/if}
  {#if error && !pending}<div class="error-banner" role="alert">
      <p>{error}</p>
      <button
        class="secondary"
        onclick={() => {
          error = '';
        }}>Dismiss</button
      >
    </div>{/if}
  <div class="actions">
    <button
      disabled={busy}
      onclick={() => {
        void download();
      }}>Export Backup</button
    >
    <button class="secondary" disabled={busy} onclick={() => fileInput.click()}
      >Import Backup</button
    >
  </div>
  <input
    bind:this={fileInput}
    class="file-picker"
    type="file"
    accept="application/json,.json"
    aria-label="Backup file"
    onchange={(event) => {
      void selectFile(event);
    }}
  />
</section>
{#if pending}<ConfirmDialog
    title="Import Backup?"
    confirmLabel="Replace Data"
    {busy}
    destructive
    oncancel={() => {
      pending = undefined;
      error = '';
    }}
    onconfirm={() => {
      void replace();
    }}
  >
    <p>This will replace all current WtReps data on this device.</p>
    <p>Your current data will be permanently removed unless you export it first.</p>
    {#if error}<p class="error-banner" role="alert">{error}</p>{/if}
  </ConfirmDialog>{/if}

<style>
  h2 {
    font-size: var(--font-size-large);
  }
  h3 {
    font-size: var(--font-size-body);
  }
  .actions {
    display: grid;
    gap: var(--space-md);
  }
  button {
    min-height: 56px;
  }
  .file-picker {
    display: none;
  }
  .error-banner p {
    margin-bottom: var(--space-md);
  }
</style>
