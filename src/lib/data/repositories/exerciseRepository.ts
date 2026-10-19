import { liveQuery } from 'dexie';
import type {
  Exercise,
  ExerciseDetails,
  ExerciseInput,
  ExerciseSetting,
  ExerciseSettingInput,
} from '../../domain/exercise.js';
import { validateExerciseInput } from '../../validation/exercise.js';
import { newRecordMetadata } from '../../utils/records.js';
import { getDatabase, type WtRepsDatabase } from '../db.js';

export function getExercise(id: string, db = getDatabase()) {
  return db.exercises.get(id);
}

export async function listExercises(db = getDatabase()) {
  const exercises = await db.exercises.toArray();
  return exercises.sort(
    (a, b) =>
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id),
  );
}

export function getExerciseDetails(
  id: string,
  db = getDatabase(),
): Promise<ExerciseDetails | undefined> {
  return db.transaction('r', [db.exercises, db.exerciseSettings], async () => {
    const exercise = await db.exercises.get(id);
    if (!exercise) return undefined;
    const settings = await db.exerciseSettings.where('exerciseId').equals(id).sortBy('position');
    return { exercise, settings };
  });
}

export function listExerciseDetails(db = getDatabase()): Promise<ExerciseDetails[]> {
  return db.transaction('r', [db.exercises, db.exerciseSettings], async () => {
    const exercises = await listExercises(db);
    const ids = exercises.map((exercise) => exercise.id);
    const settings = await db.exerciseSettings.where('exerciseId').anyOf(ids).toArray();
    return exercises.map((exercise) => ({
      exercise,
      settings: settings
        .filter((setting) => setting.exerciseId === exercise.id)
        .sort((a, b) => a.position - b.position),
    }));
  });
}

export function observeExerciseList(db = getDatabase()) {
  return liveQuery(() => listExerciseDetails(db));
}

export function getExerciseCircuits(id: string, db = getDatabase()) {
  return db.transaction('r', [db.circuitExercises, db.circuits], async () => {
    const membership = await db.circuitExercises.where('exerciseId').equals(id).toArray();
    const circuits = await db.circuits.bulkGet([
      ...new Set(membership.map((row) => row.circuitId)),
    ]);
    return circuits
      .filter((circuit) => circuit !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function createExercise(input: ExerciseInput, db = getDatabase()): Promise<Exercise> {
  const { settings, ...values } = validateExerciseInput(input);
  const exercise: Exercise = { ...values, ...newRecordMetadata() };
  await db.transaction('rw', [db.exercises, db.exerciseSettings], async () => {
    await db.exercises.add(exercise);
    await replaceSettings(exercise.id, settings, db);
  });
  return exercise;
}

export async function updateExercise(
  id: string,
  changes: Partial<ExerciseInput>,
  db = getDatabase(),
): Promise<void> {
  await db.transaction('rw', [db.exercises, db.exerciseSettings], async () => {
    const existing = await db.exercises.get(id);
    if (!existing) throw new Error('Exercise does not exist.');
    const { settings, ...values } = validateExerciseInput({ ...existing, ...changes });
    await db.exercises.update(id, { ...values, updatedAt: new Date().toISOString() });
    if (changes.settings !== undefined) await replaceSettings(id, settings, db);
  });
}

async function replaceSettings(
  exerciseId: string,
  input: ExerciseSettingInput[],
  db: WtRepsDatabase,
) {
  const existing = await db.exerciseSettings.where('exerciseId').equals(exerciseId).toArray();
  const records: ExerciseSetting[] = input.map((row) => {
    const prior = row.id ? existing.find((setting) => setting.id === row.id) : undefined;
    if (row.id && !prior)
      throw new Error('This setting no longer belongs to the exercise. Reopen it and try again.');
    return {
      ...newRecordMetadata(),
      ...prior,
      exerciseId,
      position: row.position,
      label: row.label,
      value: row.value,
      updatedAt: new Date().toISOString(),
    };
  });
  await db.exerciseSettings.where('exerciseId').equals(exerciseId).delete();
  await db.exerciseSettings.bulkAdd(records);
}

export async function deleteExercise(
  id: string,
  db: WtRepsDatabase = getDatabase(),
): Promise<void> {
  await db.transaction('rw', [db.exercises, db.exerciseSettings, db.circuitExercises], async () => {
    await db.exerciseSettings.where('exerciseId').equals(id).delete();
    await db.circuitExercises.where('exerciseId').equals(id).delete();
    await db.exercises.delete(id);
  });
}
