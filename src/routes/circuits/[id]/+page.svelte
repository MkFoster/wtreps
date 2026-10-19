<script lang="ts">
  import { page } from '$app/state';
  import CircuitEditor from '#lib/components/CircuitEditor.svelte';
</script>

{#key page.params.id}<CircuitEditor circuitId={page.params.id} />{/key}
