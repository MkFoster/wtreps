import { getDatabase } from '../data/db.js';
import { getCircuitDetails } from '../data/repositories/circuitRepository.js';
import {
  getActiveWorkout,
  getPreviousPerformance,
} from '../data/repositories/workoutRepository.js';
import { APP_SETTINGS_ID } from '../domain/settings.js';
import {
  ActiveWorkoutExistsError,
  WorkoutActionError,
  type Workout,
  type WorkoutExercise,
  type WorkoutExerciseSetting,
  type WorkoutSet,
} from '../domain/workout.js';

export async function startWorkout(circuitId: string, db = getDatabase()): Promise<Workout> {
  // All reads and writes share one transaction. IndexedDB serializes overlapping
  // read/write transactions across tabs, including the check for an active workout.
  return db.transaction(
    'rw',
    [
      db.circuits,
      db.circuitExercises,
      db.exercises,
      db.exerciseSettings,
      db.appSettings,
      db.workouts,
      db.workoutExercises,
      db.workoutExerciseSettings,
      db.workoutSets,
    ],
    async () => {
      const details = await getCircuitDetails(circuitId, db);
      if (!details)
        throw new WorkoutActionError('This circuit no longer exists. Choose another circuit.');
      if (!details.exercises.length)
        throw new WorkoutActionError('Add at least one exercise before starting this circuit.');
      const active = await getActiveWorkout(db);
      if (active) throw new ActiveWorkoutExistsError(active.id);
      const settings = await db.appSettings.get(APP_SETTINGS_ID);
      if (!settings)
        throw new WorkoutActionError(
          'WtReps could not load your preferences. Reopen the app and try again.',
        );

      const now = new Date().toISOString();
      const metadata = () => ({ id: crypto.randomUUID(), createdAt: now, updatedAt: now });
      const workout: Workout = {
        ...metadata(),
        circuitId,
        circuitName: details.circuit.name,
        status: 'in_progress',
        currentExercisePosition: 1,
        startedAt: now,
        completedAt: null,
      };
      await db.workouts.add(workout);
      for (const [index, source] of details.exercises.entries()) {
        const snapshot: WorkoutExercise = {
          ...metadata(),
          workoutId: workout.id,
          exerciseId: source.id,
          exerciseName: source.name,
          exerciseNotes: source.notes,
          position: details.membership[index]!.position,
          weightUnit: source.weightUnitOverride ?? settings.weightUnit,
        };
        await db.workoutExercises.add(snapshot);
        const machineSettings = await db.exerciseSettings
          .where('exerciseId')
          .equals(source.id)
          .sortBy('position');
        const settingSnapshots: WorkoutExerciseSetting[] = machineSettings.map((row) => ({
          ...metadata(),
          workoutExerciseId: snapshot.id,
          sourceExerciseSettingId: row.id,
          position: row.position,
          label: row.label,
          value: row.value,
        }));
        await db.workoutExerciseSettings.bulkAdd(settingSnapshots);
        const previous = await getPreviousPerformance(source.id, db);
        const suggestions: WorkoutSet[] = (previous?.sets ?? []).map((set, setIndex) => ({
          ...metadata(),
          workoutExerciseId: snapshot.id,
          position: setIndex + 1,
          weight: previous!.exercise.weightUnit === snapshot.weightUnit ? set.weight : null,
          reps: set.reps,
          isCompleted: false,
          completedAt: null,
        }));
        await db.workoutSets.bulkAdd(suggestions);
      }
      return workout;
    },
  );
}
