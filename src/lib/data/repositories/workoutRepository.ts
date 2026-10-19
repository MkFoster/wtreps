import { getDatabase } from '../db.js';
import { liveQuery } from 'dexie';
import type { WorkoutOverview } from '../../domain/workout.js';
import { resolveExercisePosition } from '../../domain/workout.js';

export function getWorkoutEntry(id: string, db = getDatabase()) {
  return db.transaction(
    'r',
    [db.workouts, db.workoutExercises, db.workoutExerciseSettings, db.workoutSets],
    async () => {
      const workout = await getWorkout(id, db);
      if (!workout) return undefined;
      const exercises = await listWorkoutExercises(id, db);
      const position = resolveExercisePosition(workout.currentExercisePosition, exercises);
      const current = exercises.find((row) => row.position === position);
      const settings = current
        ? await db.workoutExerciseSettings
            .where('workoutExerciseId')
            .equals(current.id)
            .sortBy('position')
        : [];
      const sets = current
        ? await db.workoutSets.where('workoutExerciseId').equals(current.id).sortBy('position')
        : [];
      const previous = current
        ? await getPreviousPerformance(current.exerciseId, db, id)
        : undefined;
      return { workout, exercises, current, settings, sets, previous };
    },
  );
}
export function observeWorkoutEntry(id: string, db = getDatabase()) {
  return liveQuery(() => getWorkoutEntry(id, db));
}
export type WorkoutEntry = NonNullable<Awaited<ReturnType<typeof getWorkoutEntry>>>;

export function getWorkoutSummary(id: string, db = getDatabase()) {
  return db.transaction('r', [db.workouts, db.workoutExercises, db.workoutSets], async () => {
    const workout = await getWorkout(id, db);
    if (!workout) return undefined;
    const exercises = await listWorkoutExercises(id, db);
    const sets = await db.workoutSets
      .where('workoutExerciseId')
      .anyOf(exercises.map((row) => row.id))
      .filter((row) => row.isCompleted)
      .toArray();
    return {
      workout,
      completedSetCount: sets.length,
      completedExerciseCount: new Set(sets.map((row) => row.workoutExerciseId)).size,
      durationSeconds: Math.max(
        0,
        Math.round(
          (Date.parse(workout.completedAt ?? workout.startedAt) - Date.parse(workout.startedAt)) /
            1000,
        ),
      ),
    };
  });
}

export function getWorkout(id: string, db = getDatabase()) {
  return db.workouts.get(id);
}

export function getActiveWorkout(db = getDatabase()) {
  return db.workouts.where('status').equals('in_progress').first();
}

export function listWorkoutExercises(workoutId: string, db = getDatabase()) {
  return db.workoutExercises.where('workoutId').equals(workoutId).sortBy('position');
}

export function getWorkoutOverview(
  id: string,
  db = getDatabase(),
): Promise<WorkoutOverview | undefined> {
  return db.transaction(
    'r',
    [db.workouts, db.workoutExercises, db.workoutExerciseSettings],
    async () => {
      const workout = await getWorkout(id, db);
      if (!workout) return undefined;
      const exercises = await listWorkoutExercises(id, db);
      const first = exercises[0];
      const firstExerciseSettings = first
        ? await db.workoutExerciseSettings
            .where('workoutExerciseId')
            .equals(first.id)
            .sortBy('position')
        : [];
      return { workout, exercises, firstExerciseSettings };
    },
  );
}

export function observeWorkout(id: string, db = getDatabase()) {
  return liveQuery(() => getWorkoutOverview(id, db));
}

export function getPreviousCompletedSets(exerciseId: string, db = getDatabase()) {
  return getPreviousPerformance(exerciseId, db).then((performance) => performance?.sets ?? []);
}

export function getPreviousPerformance(
  exerciseId: string,
  db = getDatabase(),
  excludeWorkoutId?: string,
) {
  return db.transaction('r', [db.workouts, db.workoutExercises, db.workoutSets], async () => {
    const snapshots = await db.workoutExercises.where('exerciseId').equals(exerciseId).toArray();
    const parents = await db.workouts.bulkGet(snapshots.map((row) => row.workoutId));
    const candidates = snapshots
      .map((snapshot, index) => ({ snapshot, workout: parents[index] }))
      .filter(
        ({ workout }) =>
          workout?.status === 'completed' &&
          workout.completedAt !== null &&
          workout.id !== excludeWorkoutId,
      )
      .sort(
        (a, b) =>
          Date.parse(b.workout!.completedAt!) - Date.parse(a.workout!.completedAt!) ||
          b.snapshot.id.localeCompare(a.snapshot.id),
      );
    for (const { snapshot } of candidates) {
      const sets = await db.workoutSets
        .where('workoutExerciseId')
        .equals(snapshot.id)
        .filter((set) => set.isCompleted)
        .sortBy('position');
      if (sets.length) return { exercise: snapshot, sets };
    }
    return undefined;
  });
}

export function getWorkoutHistory(db = getDatabase()) {
  return db.workouts
    .where('status')
    .equals('completed')
    .sortBy('completedAt')
    .then((rows) => rows.reverse());
}
