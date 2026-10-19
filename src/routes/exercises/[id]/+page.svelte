<script lang="ts">
  import { page } from '$app/state';
  import ExerciseEditor from '#lib/components/ExerciseEditor.svelte';
</script>

{#key page.params.id}<ExerciseEditor exerciseId={page.params.id} />{/key}
