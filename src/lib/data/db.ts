import Dexie, { type Table } from 'dexie';
import type { Exercise, ExerciseSetting } from '../domain/exercise.js';
import type { Circuit, CircuitExercise } from '../domain/circuit.js';
import type {
  Workout,
  WorkoutExercise,
  WorkoutExerciseSetting,
  WorkoutSet,
} from '../domain/workout.js';
import { APP_SETTINGS_ID, createDefaultSettings, type AppSettings } from '../domain/settings.js';
import { schemaV1 } from './schema.js';
import { resolveExercisePosition } from '../domain/workout.js';

export class WtRepsDatabase extends Dexie {
  exercises!: Table<Exercise, string>;
  exerciseSettings!: Table<ExerciseSetting, string>;
  circuits!: Table<Circuit, string>;
  circuitExercises!: Table<CircuitExercise, string>;
  workouts!: Table<Workout, string>;
  workoutExercises!: Table<WorkoutExercise, string>;
  workoutExerciseSettings!: Table<WorkoutExerciseSetting, string>;
  workoutSets!: Table<WorkoutSet, string>;
  appSettings!: Table<AppSettings, string>;

  constructor(name = 'WtReps') {
    super(name);
    this.version(1).stores(schemaV1);
    this.version(2)
      .stores(schemaV1)
      .upgrade(async (transaction) => {
        const workouts = await transaction.table<Workout>('workouts').toArray();
        for (const workout of workouts) {
          const exercises = await transaction
            .table<WorkoutExercise>('workoutExercises')
            .where('workoutId')
            .equals(workout.id)
            .toArray();
          await transaction.table<Workout>('workouts').update(workout.id, {
            currentExercisePosition: resolveExercisePosition(
              workout.currentExercisePosition,
              exercises,
            ),
          });
        }
      });
  }
}

// Construct lazily: importing types/repositories must not open IndexedDB during builds.
let database: WtRepsDatabase | undefined;

export function getDatabase(): WtRepsDatabase {
  return (database ??= new WtRepsDatabase());
}

export async function initializeDatabase(db = getDatabase()): Promise<void> {
  await db.open();
  // A read/write transaction serializes concurrent tabs and preserves existing preferences.
  await db.transaction('rw', db.appSettings, async () => {
    if (!(await db.appSettings.get(APP_SETTINGS_ID))) {
      await db.appSettings.add(createDefaultSettings());
    }
  });
}
