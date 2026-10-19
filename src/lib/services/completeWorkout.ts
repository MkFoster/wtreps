import { getDatabase } from '../data/db.js';
import { WorkoutActionError } from '../domain/workout.js';

export function completeWorkout(id: string, db = getDatabase()) {
  return db.transaction('rw', [db.workouts, db.workoutExercises, db.workoutSets], async () => {
    const workout = await db.workouts.get(id);
    if (!workout) throw new WorkoutActionError('This workout is no longer available.');
    if (workout.status === 'completed') return workout;
    if (workout.status !== 'in_progress')
      throw new WorkoutActionError('This workout was abandoned.');
    const exerciseIds = await db.workoutExercises.where('workoutId').equals(id).primaryKeys();
    await db.workoutSets
      .where('workoutExerciseId')
      .anyOf(exerciseIds)
      .filter((set) => !set.isCompleted)
      .delete();
    const now = new Date().toISOString();
    const completed = {
      ...workout,
      status: 'completed' as const,
      completedAt: now,
      updatedAt: now,
    };
    await db.workouts.put(completed);
    return completed;
  });
}
