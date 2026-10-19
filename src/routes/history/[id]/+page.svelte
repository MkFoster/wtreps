<script lang="ts">
  import { page } from '$app/state';
  import HistoricalWorkoutDetail from '#lib/components/HistoricalWorkoutDetail.svelte';
</script>

{#key page.params.id}<HistoricalWorkoutDetail workoutId={page.params.id!} />{/key}
