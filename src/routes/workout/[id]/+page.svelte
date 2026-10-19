<script lang="ts">
  import { page } from '$app/state';
  import ActiveWorkout from '#lib/components/ActiveWorkout.svelte';
</script>

{#key page.params.id}<ActiveWorkout workoutId={page.params.id!} />{/key}
