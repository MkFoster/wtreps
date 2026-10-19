import { getDatabase, type WtRepsDatabase } from '../data/db.js';
import { WorkoutActionError, resolveExercisePosition, type WorkoutSet } from '../domain/workout.js';
import { newRecordMetadata } from '../utils/records.js';

async function requireActive(exerciseId: string, db: WtRepsDatabase) {
  const exercise = await db.workoutExercises.get(exerciseId);
  const workout = exercise && (await db.workouts.get(exercise.workoutId));
  if (!exercise || !workout || workout.status !== 'in_progress')
    throw new WorkoutActionError('This workout is no longer in progress.');
  return { exercise, workout };
}

export interface SetValues {
  weight: number | null;
  reps: number | null;
}
export function validateSetValues(values: SetValues, completed = false) {
  if (values.weight !== null && (!Number.isFinite(values.weight) || values.weight < 0))
    throw new WorkoutActionError('Enter a weight of zero or more.');
  if (values.reps !== null && (!Number.isSafeInteger(values.reps) || values.reps < 0))
    throw new WorkoutActionError('Enter whole-number reps of zero or more.');
  if (completed && (values.weight === null || values.reps === null))
    throw new WorkoutActionError('Enter weight and reps before completing the set.');
}

function entryTransaction<T>(db: WtRepsDatabase, action: () => Promise<T>) {
  return db.transaction('rw', [db.workouts, db.workoutExercises, db.workoutSets], action);
}
export function ensureFirstSet(exerciseId: string, db = getDatabase()) {
  return entryTransaction(db, async () => {
    await requireActive(exerciseId, db);
    const existing = await db.workoutSets.where('workoutExerciseId').equals(exerciseId).first();
    if (existing) return existing;
    const set: WorkoutSet = {
      ...newRecordMetadata(),
      workoutExerciseId: exerciseId,
      position: 1,
      weight: null,
      reps: null,
      isCompleted: false,
      completedAt: null,
    };
    await db.workoutSets.add(set);
    return set;
  });
}

export function updateSetValues(id: string, values: Partial<SetValues>, db = getDatabase()) {
  return writeSet(id, values, false, db);
}
export function completeSet(id: string, values: SetValues, db = getDatabase()) {
  return writeSet(id, values, true, db);
}
function writeSet(id: string, values: Partial<SetValues>, complete: boolean, db: WtRepsDatabase) {
  return entryTransaction(db, async () => {
    const set = await db.workoutSets.get(id);
    if (!set) throw new WorkoutActionError('This set is no longer available.');
    await requireActive(set.workoutExerciseId, db);
    const updated = { ...set, ...values, updatedAt: new Date().toISOString() };
    validateSetValues(updated, complete || set.isCompleted);
    if (complete && !set.isCompleted) {
      updated.isCompleted = true;
      updated.completedAt = updated.updatedAt;
    }
    await db.workoutSets.put(updated);
    return updated;
  });
}

export function addSet(exerciseId: string, db = getDatabase()) {
  return entryTransaction(db, async () => {
    await requireActive(exerciseId, db);
    const sets = await db.workoutSets
      .where('workoutExerciseId')
      .equals(exerciseId)
      .sortBy('position');
    const last = sets.at(-1);
    const set: WorkoutSet = {
      ...newRecordMetadata(),
      workoutExerciseId: exerciseId,
      position: (last?.position ?? 0) + 1,
      weight: last?.weight ?? null,
      reps: last?.reps ?? null,
      isCompleted: false,
      completedAt: null,
    };
    await db.workoutSets.add(set);
    return set;
  });
}

export function deleteSet(id: string, db = getDatabase()) {
  return entryTransaction(db, async () => {
    const set = await db.workoutSets.get(id);
    if (!set) throw new WorkoutActionError('This set is no longer available.');
    await requireActive(set.workoutExerciseId, db);
    await db.workoutSets.delete(id);
    const remaining = await db.workoutSets
      .where('workoutExerciseId')
      .equals(set.workoutExerciseId)
      .sortBy('position');
    // Ascending updates move into vacated positions without violating the unique index.
    for (const [index, row] of remaining.entries()) {
      if (row.position !== index + 1)
        await db.workoutSets.update(row.id, {
          position: index + 1,
          updatedAt: new Date().toISOString(),
        });
    }
  });
}

export function moveCurrentExercise(workoutId: string, position: number, db = getDatabase()) {
  return entryTransaction(db, async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout || workout.status !== 'in_progress')
      throw new WorkoutActionError('This workout is no longer in progress.');
    const exercises = await db.workoutExercises
      .where('workoutId')
      .equals(workoutId)
      .sortBy('position');
    const currentExercisePosition = resolveExercisePosition(position, exercises);
    await db.workouts.update(workoutId, {
      currentExercisePosition,
      updatedAt: new Date().toISOString(),
    });
    const exercise = exercises.find((row) => row.position === currentExercisePosition);
    if (exercise) await ensureFirstSet(exercise.id, db);
    return currentExercisePosition;
  });
}

export function prepareWorkoutEntry(workoutId: string, db = getDatabase()) {
  return entryTransaction(db, async () => {
    const workout = await db.workouts.get(workoutId);
    if (workout?.status === 'in_progress')
      await moveCurrentExercise(workoutId, workout.currentExercisePosition, db);
  });
}
