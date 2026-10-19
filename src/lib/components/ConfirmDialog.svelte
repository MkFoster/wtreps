<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  let {
    title,
    confirmLabel,
    cancelLabel = 'Cancel',
    busy = false,
    destructive = false,
    onconfirm,
    oncancel,
    children,
  }: {
    title: string;
    confirmLabel: string;
    cancelLabel?: string;
    busy?: boolean;
    destructive?: boolean;
    onconfirm: () => void;
    oncancel: () => void;
    children?: Snippet;
  } = $props();
  const titleId = $props.id();
  let dialog: HTMLDialogElement;
  let cancelButton: HTMLButtonElement;

  onMount(() => {
    dialog.showModal();
    cancelButton.focus();
    return () => dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  aria-labelledby={titleId}
  oncancel={(event) => {
    event.preventDefault();
    if (!busy) oncancel();
  }}
>
  <h2 id={titleId}>{title}</h2>
  {#if children}{@render children()}{/if}
  <div class="dialog-actions">
    <button bind:this={cancelButton} class="secondary" disabled={busy} onclick={oncancel}
      >{cancelLabel}</button
    >
    <button class:danger={destructive} disabled={busy} onclick={onconfirm}
      >{busy ? 'Working…' : confirmLabel}</button
    >
  </div>
</dialog>

<style>
  dialog {
    width: min(90vw, 520px);
    max-height: 85dvh;
    overflow: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    color: var(--color-text);
    background: var(--color-surface);
  }
  dialog::backdrop {
    background: #172e2880;
  }
  h2 {
    font-size: var(--font-size-large);
    margin: 0 0 var(--space-lg);
    overflow-wrap: anywhere;
  }
  .dialog-actions {
    display: grid;
    gap: var(--space-md);
    margin-top: var(--space-lg);
  }
</style>
