import { liveQuery } from 'dexie';
import { getDatabase } from '../db.js';
import { getWorkoutHistory, getWorkoutSummary, listWorkoutExercises } from './workoutRepository.js';

export function listCompletedWorkouts(db = getDatabase()) {
  return db.transaction('r', [db.workouts, db.workoutExercises, db.workoutSets], async () => {
    const workouts = await getWorkoutHistory(db);
    const summaries = await Promise.all(
      workouts.map((workout) => getWorkoutSummary(workout.id, db)),
    );
    return summaries.filter((row): row is NonNullable<typeof row> => !!row);
  });
}
export function observeCompletedWorkouts(db = getDatabase()) {
  return liveQuery(() => listCompletedWorkouts(db));
}

export function getHistoricalWorkout(id: string, db = getDatabase()) {
  return db.transaction(
    'r',
    [db.workouts, db.workoutExercises, db.workoutExerciseSettings, db.workoutSets],
    async () => {
      const summary = await getWorkoutSummary(id, db);
      if (!summary || summary.workout.status !== 'completed') return undefined;
      const snapshots = await listWorkoutExercises(id, db);
      const exercises = await Promise.all(
        snapshots.map(async (exercise) => ({
          exercise,
          settings: await db.workoutExerciseSettings
            .where('workoutExerciseId')
            .equals(exercise.id)
            .sortBy('position'),
          sets: await db.workoutSets
            .where('workoutExerciseId')
            .equals(exercise.id)
            .filter((row) => row.isCompleted)
            .sortBy('position'),
        })),
      );
      return { ...summary, exercises };
    },
  );
}
export type HistoricalWorkout = NonNullable<Awaited<ReturnType<typeof getHistoricalWorkout>>>;
export function observeHistoricalWorkout(id: string, db = getDatabase()) {
  return liveQuery(() => getHistoricalWorkout(id, db));
}

export function getExerciseHistory(exerciseId: string, db = getDatabase()) {
  return db.transaction('r', [db.workouts, db.workoutExercises, db.workoutSets], async () => {
    const snapshots = await db.workoutExercises.where('exerciseId').equals(exerciseId).toArray();
    const entries = [];
    for (const exercise of snapshots) {
      const workout = await db.workouts.get(exercise.workoutId);
      if (workout?.status !== 'completed') continue;
      const sets = await db.workoutSets
        .where('workoutExerciseId')
        .equals(exercise.id)
        .filter((row) => row.isCompleted)
        .sortBy('position');
      if (sets.length) entries.push({ workout, exercise, sets });
    }
    return entries.sort(
      (a, b) =>
        Date.parse(b.workout.completedAt ?? b.workout.startedAt) -
          Date.parse(a.workout.completedAt ?? a.workout.startedAt) ||
        b.workout.id.localeCompare(a.workout.id),
    );
  });
}
export function observeExerciseHistory(exerciseId: string, db = getDatabase()) {
  return liveQuery(() => getExerciseHistory(exerciseId, db));
}
