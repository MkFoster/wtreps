<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import BottomNav from '#lib/components/BottomNav.svelte';
  import { initializeApp } from '#lib/services/initializeApp.js';
  import '../app.css';

  let { children }: { children: Snippet } = $props();
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let offlineReady = $state(false);
  let pwaError = $state(false);
  const workoutRoute = $derived(
    page.url.pathname.startsWith('/workout/') ||
      /^\/history\/[^/]+(?:\/edit)?\/?$/.test(page.url.pathname),
  );

  async function load() {
    status = 'loading';
    try {
      await initializeApp();
      status = 'ready';
    } catch (error) {
      console.error('Database initialization failed', error);
      status = 'error';
    }
  }

  onMount(() => {
    void load();
    if (import.meta.env.PROD) {
      void import('virtual:pwa-register')
        .then(({ registerSW }) => {
          // Prompt mode leaves updates waiting. Never activate/reload during a workout.
          registerSW({
            immediate: true,
            onOfflineReady: () => {
              offlineReady = true;
            },
            onRegisterError: (error: unknown) => {
              console.error('Offline shell registration failed', error);
              pwaError = true;
            },
          });
        })
        .catch((error: unknown) => {
          console.error('Offline shell could not load', error);
          pwaError = true;
        });
    }
  });
</script>

<svelte:head>
  <title>WtReps</title>
  <meta name="description" content="Local-first machine workout tracking." />
</svelte:head>

<a class="skip-link" href="#main">Skip to content</a>
<div class="app-shell" class:workout-shell={workoutRoute}>
  {#if !workoutRoute}<header class="app-header">
      <a href="/" aria-label="WtReps home">WtReps</a>
    </header>{/if}
  <main id="main" tabindex="-1">
    {#if status === 'loading'}
      <p role="status">Loading…</p>
    {:else if status === 'error'}
      <section role="alert">
        <h1>WtReps couldn’t load your workout data.</h1>
        <p>Your browser’s local storage may be unavailable.</p>
        <button onclick={load}>Retry</button>
      </section>
    {:else}
      {@render children()}
      {#if offlineReady}<p class="storage-note" role="status">Ready for offline use.</p>{/if}
      {#if pwaError}
        <p role="alert">
          Offline setup couldn’t finish. Reopen WtReps while connected to try again.
        </p>
      {/if}
    {/if}
  </main>
  {#if !workoutRoute}<BottomNav />{/if}
</div>

<style>
  .workout-shell {
    padding-top: env(safe-area-inset-top);
  }
  .workout-shell main {
    padding-bottom: calc(var(--space-lg) + env(safe-area-inset-bottom));
  }
</style>
