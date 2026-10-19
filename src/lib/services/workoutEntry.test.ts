import Dexie from 'dexie';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initializeDatabase, WtRepsDatabase } from '../data/db.js';
import { schemaV1 } from '../data/schema.js';
import { createExercise, updateExercise } from '../data/repositories/exerciseRepository.js';
import { createCircuit } from '../data/repositories/circuitRepository.js';
import {
  getWorkoutEntry,
  getWorkoutSummary,
  getActiveWorkout,
  getPreviousPerformance,
} from '../data/repositories/workoutRepository.js';
import { startWorkout } from './startWorkout.js';
import { completeWorkout } from './completeWorkout.js';
import {
  addSet,
  completeSet,
  deleteSet,
  ensureFirstSet,
  moveCurrentExercise,
  prepareWorkoutEntry,
  updateSetValues,
} from './workoutEntry.js';
import type { Workout, WorkoutExercise } from '../domain/workout.js';

let db: WtRepsDatabase;
let workout: Workout;
let exercises: WorkoutExercise[];
let circuitId: string;
beforeEach(async () => {
  db = new WtRepsDatabase(`WtReps-entry-${crypto.randomUUID()}`);
  await initializeDatabase(db);
  const source = await Promise.all(
    ['Chest Press', 'Leg Press'].map((name) =>
      createExercise(
        {
          name,
          notes: 'Neutral grip',
          weightUnitOverride: null,
          settings: [{ position: 1, label: 'Seat', value: '7' }],
        },
        db,
      ),
    ),
  );
  const circuit = await createCircuit(
    { name: 'Full Body', description: '', exerciseIds: source.map((row) => row.id) },
    db,
  );
  circuitId = circuit.id;
  workout = await startWorkout(circuit.id, db);
  exercises = (await getWorkoutEntry(workout.id, db))!.exercises;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});

it('creates one empty first Set, including concurrent calls and reopening', async () => {
  await Promise.all([ensureFirstSet(exercises[0]!.id, db), ensureFirstSet(exercises[0]!.id, db)]);
  await prepareWorkoutEntry(workout.id, db);
  db.close();
  await db.open();
  await prepareWorkoutEntry(workout.id, db);
  expect(await db.workoutSets.toArray()).toMatchObject([
    { position: 1, weight: null, reps: null, isCompleted: false, completedAt: null },
  ]);
});
it('persists decimal weight, integer reps, and clearing independently', async () => {
  const set = await ensureFirstSet(exercises[0]!.id, db);
  await updateSetValues(set.id, { weight: 102.5 }, db);
  await updateSetValues(set.id, { reps: 12 }, db);
  expect(await db.workoutSets.get(set.id)).toMatchObject({ weight: 102.5, reps: 12 });
  await updateSetValues(set.id, { weight: null }, db);
  expect(await db.workoutSets.get(set.id)).toMatchObject({ weight: null, reps: 12 });
});
it.each([
  { weight: null, reps: 1 },
  { weight: 1, reps: null },
  { weight: -1, reps: 1 },
  { weight: 1, reps: -1 },
  { weight: 1, reps: 1.5 },
  { weight: NaN, reps: 1 },
  { weight: Infinity, reps: 1 },
])('rejects invalid completion %j without changing the Set', async (values) => {
  const set = await ensureFirstSet(exercises[0]!.id, db);
  await expect(completeSet(set.id, values, db)).rejects.toThrow();
  expect(await db.workoutSets.get(set.id)).toEqual(set);
});
it('completes valid zero values and edits completed Sets without recompleting', async () => {
  const set = await ensureFirstSet(exercises[0]!.id, db);
  const completed = await completeSet(set.id, { weight: 0, reps: 0 }, db);
  await db.workoutSets.update(set.id, { updatedAt: '2000-01-01T00:00:00.000Z' });
  const edited = await updateSetValues(set.id, { weight: 25.5, reps: 10 }, db);
  expect(edited).toMatchObject({
    isCompleted: true,
    weight: 25.5,
    reps: 10,
    completedAt: completed.completedAt,
  });
  expect(edited.updatedAt).not.toBe('2000-01-01T00:00:00.000Z');
  await expect(updateSetValues(set.id, { weight: null }, db)).rejects.toThrow();
});
it('adds Sets copying the last current values including nulls', async () => {
  const first = await ensureFirstSet(exercises[0]!.id, db);
  expect(await addSet(exercises[0]!.id, db)).toMatchObject({
    position: 2,
    weight: null,
    reps: null,
    isCompleted: false,
  });
  await updateSetValues(first.id, { weight: 100, reps: 12 }, db);
  const second = (await getWorkoutEntry(workout.id, db))!.sets[1]!;
  await completeSet(second.id, { weight: 95, reps: 10 }, db);
  expect(await addSet(exercises[0]!.id, db)).toMatchObject({
    position: 3,
    weight: 95,
    reps: 10,
    isCompleted: false,
    completedAt: null,
  });
});
it('deletes only the Set and normalizes positions without unique-index collisions', async () => {
  const a = await addSet(exercises[0]!.id, db);
  const b = await addSet(exercises[0]!.id, db);
  const c = await addSet(exercises[0]!.id, db);
  await deleteSet(a.id, db);
  expect(
    (await getWorkoutEntry(workout.id, db))!.sets.map((row) => [row.id, row.position]),
  ).toEqual([
    [b.id, 1],
    [c.id, 2],
  ]);
  expect(await db.workoutExercises.count()).toBe(2);
});
it('navigates by snapshot position, clamps, and resumes exact Exercise after reopening', async () => {
  await db.workoutExercises.update(exercises[1]!.id, { position: 4 });
  expect(await moveCurrentExercise(workout.id, 4, db)).toBe(4);
  db.close();
  await db.open();
  await prepareWorkoutEntry(workout.id, db);
  expect((await getWorkoutEntry(workout.id, db))!.current?.id).toBe(exercises[1]!.id);
  expect((await getActiveWorkout(db))!.currentExercisePosition).toBe(4);
  expect(await moveCurrentExercise(workout.id, 99, db)).toBe(4);
  expect(await moveCurrentExercise(workout.id, -5, db)).toBe(1);
  expect(await moveCurrentExercise(workout.id, NaN, db)).toBe(1);
});
it('ends transactionally, preserves completed Sets, and derives counts and duration', async () => {
  const first = await ensureFirstSet(exercises[0]!.id, db);
  await completeSet(first.id, { weight: 100, reps: 12 }, db);
  await addSet(exercises[0]!.id, db);
  await ensureFirstSet(exercises[1]!.id, db);
  await db.workouts.update(workout.id, { startedAt: new Date(Date.now() - 120000).toISOString() });
  await completeWorkout(workout.id, db);
  const summary = (await getWorkoutSummary(workout.id, db))!;
  expect(summary).toMatchObject({
    completedSetCount: 1,
    completedExerciseCount: 1,
    workout: { status: 'completed' },
  });
  expect(summary.durationSeconds).toBeGreaterThanOrEqual(120);
  expect(await db.workoutSets.count()).toBe(1);
  expect((await db.workoutSets.get(first.id))!.isCompleted).toBe(true);
  expect(await getActiveWorkout(db)).toBeUndefined();
  await expect(updateSetValues(first.id, { reps: 9 }, db)).rejects.toThrow('no longer');
  await expect(addSet(exercises[0]!.id, db)).rejects.toThrow();
  await expect(moveCurrentExercise(workout.id, 2, db)).rejects.toThrow();
});
it('rolls back cleanup if completing the parent fails', async () => {
  const set = await ensureFirstSet(exercises[0]!.id, db);
  vi.spyOn(db.workouts, 'put').mockRejectedValueOnce(new Error('Storage failure'));
  await expect(completeWorkout(workout.id, db)).rejects.toThrow('Storage failure');
  expect(await db.workoutSets.get(set.id)).toEqual(set);
  expect((await getActiveWorkout(db))!.id).toBe(workout.id);
});
it.each(['lb', 'kg'] as const)(
  'suggests with current %s units and retains historical lb Last Time',
  async (unit) => {
    const set = await ensureFirstSet(exercises[0]!.id, db);
    await completeSet(set.id, { weight: 100, reps: 12 }, db);
    await completeWorkout(workout.id, db);
    await updateExercise(
      exercises[0]!.exerciseId,
      { weightUnitOverride: unit, name: 'Renamed', notes: 'Changed' },
      db,
    );
    const next = await startWorkout(circuitId, db);
    const entry = (await getWorkoutEntry(next.id, db))!;
    expect(entry.sets[0]).toMatchObject({
      weight: unit === 'lb' ? 100 : null,
      reps: 12,
      isCompleted: false,
      completedAt: null,
    });
    expect(entry.previous).toMatchObject({
      exercise: { weightUnit: 'lb', exerciseName: 'Chest Press' },
      sets: [{ weight: 100, reps: 12 }],
    });
    expect(await getPreviousPerformance(exercises[0]!.exerciseId, db, workout.id)).toBeUndefined();
    const original = (await getWorkoutEntry(workout.id, db))!;
    expect(original.current).toMatchObject({
      exerciseName: 'Chest Press',
      exerciseNotes: 'Neutral grip',
    });
    expect(original.settings[0]?.value).toBe('7');
  },
);

it('migrates version 1 Workouts without changing snapshots or timestamps', async () => {
  const name = `WtReps-v1-${crypto.randomUUID()}`;
  const legacy = new Dexie(name);
  legacy.version(1).stores(schemaV1);
  await legacy.open();
  const { currentExercisePosition: _position, ...oldWorkout } = workout;
  await legacy.table('workouts').add(oldWorkout);
  await legacy.table('workoutExercises').bulkAdd(exercises);
  const invalid = { ...oldWorkout, id: crypto.randomUUID(), currentExercisePosition: 999 };
  await legacy.table('workouts').add(invalid);
  await legacy
    .table('workoutExercises')
    .add({ ...exercises[0]!, id: crypto.randomUUID(), workoutId: invalid.id, position: 3 });
  legacy.close();
  const upgraded = new WtRepsDatabase(name);
  try {
    await upgraded.open();
    expect(upgraded.verno).toBe(2);
    expect(await upgraded.workouts.get(workout.id)).toEqual({
      ...oldWorkout,
      currentExercisePosition: 1,
    });
    expect((await upgraded.workouts.get(invalid.id))!.currentExercisePosition).toBe(3);
    expect(
      await upgraded.workoutExercises.where('workoutId').equals(workout.id).sortBy('position'),
    ).toEqual(exercises);
  } finally {
    await upgraded.delete();
  }
});
