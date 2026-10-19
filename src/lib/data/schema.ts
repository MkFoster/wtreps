// Version 1 is immutable after release. Add a new Dexie version for future changes.
export const schemaV1 = {
  exercises: 'id, name, updatedAt',
  exerciseSettings: 'id, exerciseId, &[exerciseId+position]',
  circuits: 'id, name, updatedAt',
  circuitExercises: 'id, circuitId, exerciseId, &[circuitId+position], &[circuitId+exerciseId]',
  workouts: 'id, status, startedAt, completedAt, circuitId',
  workoutExercises: 'id, workoutId, exerciseId, &[workoutId+position]',
  workoutExerciseSettings: 'id, workoutExerciseId, [workoutExerciseId+position]',
  // IndexedDB cannot index booleans: isCompleted stays a boolean field, queried by filtering.
  workoutSets: 'id, workoutExerciseId, &[workoutExerciseId+position], completedAt',
  appSettings: 'id',
} as const;
