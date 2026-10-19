import { liveQuery } from 'dexie';
import { getDatabase } from '../db.js';
import { listCircuitSummaries } from './circuitRepository.js';
import { getActiveWorkout, listWorkoutExercises } from './workoutRepository.js';
import { resolveExercisePosition } from '../../domain/workout.js';

export function getHomeData(db = getDatabase()) {
  return db.transaction(
    'r',
    [db.circuits, db.circuitExercises, db.workouts, db.workoutExercises],
    async () => {
      const circuits = await listCircuitSummaries(db);
      const workout = await getActiveWorkout(db);
      const exercises = workout ? await listWorkoutExercises(workout.id, db) : [];
      return {
        circuits,
        active: workout
          ? {
              workout,
              exerciseCount: exercises.length,
              currentExerciseNumber:
                exercises.findIndex(
                  (row) =>
                    row.position ===
                    resolveExercisePosition(workout.currentExercisePosition, exercises),
                ) + 1,
            }
          : undefined,
      };
    },
  );
}

export function observeHome(db = getDatabase()) {
  return liveQuery(() => getHomeData(db));
}

export type HomeData = Awaited<ReturnType<typeof getHomeData>>;
