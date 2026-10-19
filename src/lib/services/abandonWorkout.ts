import { getDatabase } from '../data/db.js';
import { WorkoutActionError, type Workout } from '../domain/workout.js';

export async function abandonWorkout(id: string, db = getDatabase()): Promise<Workout> {
  return db.transaction('rw', [db.workouts, db.workoutExercises, db.workoutSets], async () => {
    const workout = await db.workouts.get(id);
    if (!workout) throw new WorkoutActionError('This workout is no longer available.');
    // Repeating an already successful abandon must not rewrite its end time.
    if (workout.status === 'abandoned') return workout;
    if (workout.status !== 'in_progress')
      throw new WorkoutActionError('Only a workout in progress can be abandoned.');
    const exerciseIds = await db.workoutExercises.where('workoutId').equals(id).primaryKeys();
    await db.workoutSets
      .where('workoutExerciseId')
      .anyOf(exerciseIds)
      .filter((set) => !set.isCompleted)
      .delete();
    const now = new Date().toISOString();
    const abandoned: Workout = {
      ...workout,
      status: 'abandoned',
      completedAt: now,
      updatedAt: now,
    };
    await db.workouts.put(abandoned);
    return abandoned;
  });
}
