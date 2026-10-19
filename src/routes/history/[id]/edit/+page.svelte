<script lang="ts">
  import { page } from '$app/state';
  import HistoricalWorkoutEditor from '#lib/components/HistoricalWorkoutEditor.svelte';
</script>

{#key page.params.id}<HistoricalWorkoutEditor workoutId={page.params.id!} />{/key}
