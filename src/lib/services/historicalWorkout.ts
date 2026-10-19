import { getDatabase } from '../data/db.js';
import { getHistoricalWorkout } from '../data/repositories/historyRepository.js';
import type { HistoricalWorkoutDraft } from '../domain/historyForm.js';
import { WorkoutActionError, type WorkoutSet } from '../domain/workout.js';
import { newRecordMetadata } from '../utils/records.js';
import { validateSetValues } from './workoutEntry.js';

export function saveHistoricalWorkout(
  id: string,
  draft: HistoricalWorkoutDraft,
  db = getDatabase(),
) {
  return db.transaction(
    'rw',
    [db.workouts, db.workoutExercises, db.workoutExerciseSettings, db.workoutSets],
    async () => {
      const detail = await getHistoricalWorkout(id, db);
      if (!detail) throw new WorkoutActionError('This completed workout is no longer available.');
      if (detail.workout.updatedAt !== draft.updatedAt)
        throw new WorkoutActionError(
          'This workout changed in another window. Reload before editing again.',
        );
      const sameIds = (actual: string[], expected: string[]) =>
        actual.length === expected.length &&
        new Set(actual).size === actual.length &&
        actual.every((value) => expected.includes(value));
      if (
        !sameIds(
          draft.exercises.map((row) => row.id),
          detail.exercises.map((row) => row.exercise.id),
        )
      )
        throw new WorkoutActionError(
          'The workout exercises have changed. Reload before editing again.',
        );
      const now = new Date(
        Math.max(Date.now(), Date.parse(detail.workout.updatedAt) + 1),
      ).toISOString();
      for (const input of draft.exercises) {
        const source = detail.exercises.find((row) => row.exercise.id === input.id)!;
        if (
          !sameIds(
            input.settings.map((row) => row.id),
            source.settings.map((row) => row.id),
          )
        )
          throw new WorkoutActionError(
            'The machine settings have changed. Reload before editing again.',
          );
        const seen = new Set<string>();
        const sets: WorkoutSet[] = input.sets.map((row, index) => {
          if (!row.weight.trim() || !row.reps.trim())
            throw new WorkoutActionError('Every historical set needs weight and reps.');
          if (!/^\d*(?:\.\d*)?$/.test(row.weight.trim()) || !/^\d+$/.test(row.reps.trim()))
            throw new WorkoutActionError('Use a weight of zero or more and whole-number reps.');
          const values = { weight: Number(row.weight), reps: Number(row.reps) };
          validateSetValues(values, true);
          const existing = row.id ? source.sets.find((set) => set.id === row.id) : undefined;
          if (row.id && (!existing || seen.has(row.id)))
            throw new WorkoutActionError(
              'A set is no longer available. Reload before editing again.',
            );
          if (row.id) seen.add(row.id);
          const changed =
            !existing ||
            existing.weight !== values.weight ||
            existing.reps !== values.reps ||
            existing.position !== index + 1;
          return {
            ...(existing ?? newRecordMetadata()),
            ...values,
            workoutExerciseId: input.id,
            position: index + 1,
            isCompleted: true,
            completedAt: existing ? existing.completedAt : now,
            updatedAt: changed ? now : existing!.updatedAt,
          };
        });
        // Replace this exercise's Sets together, avoiding transient unique-position collisions.
        await db.workoutSets.where('workoutExerciseId').equals(input.id).delete();
        await db.workoutSets.bulkAdd(sets);
        for (const row of input.settings) {
          const value = row.value.trim();
          if (!value || value.length > 100)
            throw new WorkoutActionError('Machine setting values need 1–100 characters.');
          const existing = source.settings.find((setting) => setting.id === row.id)!;
          if (existing.value !== value)
            await db.workoutExerciseSettings.update(row.id, { value, updatedAt: now });
        }
      }
      await db.workouts.update(id, { updatedAt: now });
    },
  );
}

export function deleteHistoricalWorkout(id: string, db = getDatabase()) {
  return db.transaction(
    'rw',
    [db.workouts, db.workoutExercises, db.workoutExerciseSettings, db.workoutSets],
    async () => {
      const workout = await db.workouts.get(id);
      if (!workout || workout.status !== 'completed')
        throw new WorkoutActionError('This completed workout is no longer available.');
      const ids = await db.workoutExercises.where('workoutId').equals(id).primaryKeys();
      await db.workoutSets.where('workoutExerciseId').anyOf(ids).delete();
      await db.workoutExerciseSettings.where('workoutExerciseId').anyOf(ids).delete();
      await db.workoutExercises.bulkDelete(ids);
      await db.workouts.delete(id);
    },
  );
}
