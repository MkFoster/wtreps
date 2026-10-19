import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initializeDatabase, WtRepsDatabase } from '../data/db.js';
import {
  createExercise,
  updateExercise,
  deleteExercise,
} from '../data/repositories/exerciseRepository.js';
import {
  createCircuit,
  updateCircuit,
  deleteCircuit,
} from '../data/repositories/circuitRepository.js';
import {
  getExerciseHistory,
  getHistoricalWorkout,
  listCompletedWorkouts,
} from '../data/repositories/historyRepository.js';
import { getPreviousPerformance } from '../data/repositories/workoutRepository.js';
import { createHistoryDraft, newHistoricalSet } from '../domain/historyForm.js';
import type { Exercise } from '../domain/exercise.js';
import type { Circuit } from '../domain/circuit.js';
import { APP_SETTINGS_ID } from '../domain/settings.js';
import { startWorkout } from './startWorkout.js';
import { completeWorkout } from './completeWorkout.js';
import { completeSet, ensureFirstSet, addSet } from './workoutEntry.js';
import { deleteHistoricalWorkout, saveHistoricalWorkout } from './historicalWorkout.js';

let db: WtRepsDatabase;
let chest: Exercise;
let leg: Exercise;
let circuit: Circuit;
let workoutId: string;
beforeEach(async () => {
  db = new WtRepsDatabase(`WtReps-history-${crypto.randomUUID()}`);
  await initializeDatabase(db);
  chest = await createExercise(
    {
      name: 'Chest Press',
      notes: 'Neutral grip',
      weightUnitOverride: null,
      settings: [{ position: 1, label: 'Seat', value: '7' }],
    },
    db,
  );
  leg = await createExercise({ name: 'Leg Press', notes: '', weightUnitOverride: null }, db);
  circuit = await createCircuit(
    { name: 'Full Body', description: '', exerciseIds: [leg.id, chest.id] },
    db,
  );
  workoutId = await record(circuit.id, '2026-10-19T10:47:00.000Z');
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});
async function record(circuitId: string, completedAt: string) {
  const workout = await startWorkout(circuitId, db);
  const snapshots = await db.workoutExercises
    .where('workoutId')
    .equals(workout.id)
    .sortBy('position');
  const snapshot = snapshots.find((row) => row.exerciseId === chest.id)!;
  const first = await ensureFirstSet(snapshot.id, db);
  await completeSet(first.id, { weight: 100, reps: 12 }, db);
  const second = await addSet(snapshot.id, db);
  await completeSet(second.id, { weight: 95, reps: 10 }, db);
  await completeWorkout(workout.id, db);
  await db.workouts.update(workout.id, {
    startedAt: new Date(Date.parse(completedAt) - 47 * 60000).toISOString(),
    completedAt,
  });
  return workout.id;
}
async function detail() {
  return (await getHistoricalWorkout(workoutId, db))!;
}

it('lists only completed Workouts newest first by completion time with derived counts/duration', async () => {
  const older = await record(circuit.id, '2026-10-10T12:00:00.000Z');
  const original = (await detail()).workout;
  for (const status of ['in_progress', 'abandoned'] as const)
    await db.workouts.add({
      ...original,
      id: crypto.randomUUID(),
      status,
      completedAt: status === 'in_progress' ? null : '2026-11-01T10:00:00.000Z',
    });
  const entries = await listCompletedWorkouts(db);
  expect(entries.map((row) => row.workout.id)).toEqual([workoutId, older]);
  expect(entries[0]).toMatchObject({
    durationSeconds: 2820,
    completedExerciseCount: 1,
    completedSetCount: 2,
  });
});
it('loads snapshot Exercises/settings/Sets in explicit position order and excludes incomplete Sets', async () => {
  const result = await detail();
  expect(result.exercises.map((row) => row.exercise.exerciseName)).toEqual([
    'Leg Press',
    'Chest Press',
  ]);
  expect(result.exercises[0]!.sets).toEqual([]);
  expect(result.exercises[1]!).toMatchObject({
    exercise: { weightUnit: 'lb', exerciseNotes: 'Neutral grip' },
    settings: [{ label: 'Seat', value: '7' }],
    sets: [
      { weight: 100, reps: 12 },
      { weight: 95, reps: 10 },
    ],
  });
  const set = result.exercises[1]!.sets[0]!;
  await db.workoutSets.add({
    ...set,
    id: crypto.randomUUID(),
    position: 3,
    isCompleted: false,
    completedAt: null,
  });
  expect((await detail()).exercises[1]!.sets).toHaveLength(2);
});
it('keeps detail unchanged after Circuit rename, reorder and deletion', async () => {
  const before = await detail();
  await updateCircuit(
    circuit.id,
    { name: 'Renamed', description: '', exerciseIds: [chest.id, leg.id] },
    db,
  );
  expect(await detail()).toEqual(before);
  await deleteCircuit(circuit.id, db);
  expect(await detail()).toEqual(before);
});
it('keeps detail unchanged after Exercise rename, settings/notes/units changes and deletion', async () => {
  const before = await detail();
  await updateExercise(
    chest.id,
    {
      name: 'Renamed',
      notes: 'Changed',
      weightUnitOverride: 'kg',
      settings: [{ position: 1, label: 'Seat', value: '8' }],
    },
    db,
  );
  await db.appSettings.update(APP_SETTINGS_ID, { weightUnit: 'kg' });
  expect(await detail()).toEqual(before);
  await deleteExercise(chest.id, db);
  expect(await detail()).toEqual(before);
});
it('edits completed Sets preserving completion/creation timestamps and updating parent metadata', async () => {
  const before = await detail();
  const draft = createHistoryDraft(before);
  draft.exercises[1]!.sets[0]!.weight = '102.5';
  draft.exercises[1]!.sets[0]!.reps = '11';
  await saveHistoricalWorkout(workoutId, draft, db);
  const after = await detail();
  expect(after.exercises[1]!.sets[0]).toMatchObject({
    id: before.exercises[1]!.sets[0]!.id,
    weight: 102.5,
    reps: 11,
    isCompleted: true,
    completedAt: before.exercises[1]!.sets[0]!.completedAt,
    createdAt: before.exercises[1]!.sets[0]!.createdAt,
  });
  expect(after.workout.updatedAt).not.toBe(before.workout.updatedAt);
  expect(after.exercises[1]!.sets[1]).toEqual(before.exercises[1]!.sets[1]);
  expect((await getPreviousPerformance(chest.id, db))!.sets[0]!.weight).toBe(102.5);
});
it('adds a completed historical Set at Save time and allows correcting a skipped snapshot', async () => {
  const draft = createHistoryDraft(await detail());
  const row = draft.exercises[1]!;
  row.sets.push(newHistoricalSet(row.sets));
  draft.exercises[0]!.sets.push({ key: crypto.randomUUID(), weight: '0', reps: '0' });
  const started = Date.now();
  await saveHistoricalWorkout(workoutId, draft, db);
  const result = await detail();
  const added = result.exercises[1]!.sets[2]!;
  expect(added).toMatchObject({ position: 3, weight: 95, reps: 10, isCompleted: true });
  expect(Date.parse(added.completedAt!)).toBeGreaterThanOrEqual(started);
  expect(result).toMatchObject({ completedExerciseCount: 2, completedSetCount: 4 });
});
it('removes Sets and normalizes positions while preserving surviving IDs', async () => {
  const before = await detail();
  const draft = createHistoryDraft(before);
  draft.exercises[1]!.sets.splice(0, 1);
  await saveHistoricalWorkout(workoutId, draft, db);
  expect((await detail()).exercises[1]!.sets).toMatchObject([
    { id: before.exercises[1]!.sets[1]!.id, position: 1, isCompleted: true },
  ]);
  const empty = createHistoryDraft(await detail());
  empty.exercises[1]!.sets = [];
  await saveHistoricalWorkout(workoutId, empty, db);
  expect(await detail()).toMatchObject({ completedSetCount: 0, completedExerciseCount: 0 });
  expect(await getExerciseHistory(chest.id, db)).toEqual([]);
});
it('corrects only historical setting values and leaves all templates untouched', async () => {
  const templates = await db.exerciseSettings.toArray();
  const source = await db.exercises.toArray();
  const before = await detail();
  const draft = createHistoryDraft(before);
  draft.exercises[1]!.settings[0]!.value = ' B ';
  await saveHistoricalWorkout(workoutId, draft, db);
  expect((await detail()).exercises[1]!.settings[0]).toMatchObject({
    value: 'B',
    label: 'Seat',
    sourceExerciseSettingId: before.exercises[1]!.settings[0]!.sourceExerciseSettingId,
  });
  expect(await db.exerciseSettings.toArray()).toEqual(templates);
  expect(await db.exercises.toArray()).toEqual(source);
});
it.each([
  { weight: '', reps: '12' },
  { weight: '-1', reps: '12' },
  { weight: '1', reps: '1.5' },
  { weight: 'Infinity', reps: '12' },
])('rejects invalid historical Set values %j atomically', async (values) => {
  const before = await detail();
  const draft = createHistoryDraft(before);
  Object.assign(draft.exercises[1]!.sets[0]!, values);
  await expect(saveHistoricalWorkout(workoutId, draft, db)).rejects.toThrow();
  expect(await detail()).toEqual(before);
});
it('rolls back earlier Set writes if a setting fails validation', async () => {
  const before = await detail();
  const draft = createHistoryDraft(before);
  draft.exercises[1]!.sets[0]!.weight = '55';
  draft.exercises[1]!.settings[0]!.value = ' ';
  await expect(saveHistoricalWorkout(workoutId, draft, db)).rejects.toThrow('Machine setting');
  expect(await detail()).toEqual(before);
});
it('rejects stale drafts without overwriting another correction', async () => {
  const draft = createHistoryDraft(await detail());
  await saveHistoricalWorkout(workoutId, draft, db);
  const saved = await detail();
  await expect(saveHistoricalWorkout(workoutId, draft, db)).rejects.toThrow('another window');
  expect(await detail()).toEqual(saved);
});
it('rejects foreign/duplicate Set IDs and adding foreign Exercise/setting snapshots', async () => {
  const before = await detail();
  for (const change of ['exercise', 'setting', 'set', 'duplicate'] as const) {
    const draft = createHistoryDraft(before);
    if (change === 'exercise') draft.exercises[0]!.id = crypto.randomUUID();
    if (change === 'setting') draft.exercises[1]!.settings[0]!.id = crypto.randomUUID();
    if (change === 'set') draft.exercises[1]!.sets[0]!.id = crypto.randomUUID();
    if (change === 'duplicate') draft.exercises[1]!.sets.push({ ...draft.exercises[1]!.sets[0]! });
    await expect(saveHistoricalWorkout(workoutId, draft, db)).rejects.toThrow();
    expect(await detail()).toEqual(before);
  }
});
it('rolls back all corrections on storage failure', async () => {
  const before = await detail();
  const draft = createHistoryDraft(before);
  draft.exercises[1]!.sets.splice(0, 1);
  vi.spyOn(db.workouts, 'update').mockRejectedValueOnce(new Error('Storage failure'));
  await expect(saveHistoricalWorkout(workoutId, draft, db)).rejects.toThrow('Storage failure');
  expect(await detail()).toEqual(before);
});
it('deletes only the selected Workout and all children, preserving templates and other history', async () => {
  const other = await record(circuit.id, '2026-10-20T10:00:00.000Z');
  const templates = await db.exerciseSettings.toArray();
  const childIds = (await detail()).exercises.map((row) => row.exercise.id);
  await deleteHistoricalWorkout(workoutId, db);
  expect(await getHistoricalWorkout(workoutId, db)).toBeUndefined();
  expect(await db.workoutExercises.where('workoutId').equals(workoutId).count()).toBe(0);
  expect(await db.workoutSets.where('workoutExerciseId').anyOf(childIds).count()).toBe(0);
  expect(await db.workoutExerciseSettings.where('workoutExerciseId').anyOf(childIds).count()).toBe(
    0,
  );
  expect(await getHistoricalWorkout(other, db)).toBeDefined();
  expect(await db.circuits.get(circuit.id)).toEqual(circuit);
  expect(await db.exercises.count()).toBe(2);
  expect(await db.exerciseSettings.toArray()).toEqual(templates);
});
it('rolls back cascade deletion on storage failure', async () => {
  const before = await detail();
  vi.spyOn(db.workouts, 'delete').mockRejectedValueOnce(new Error('Storage failure'));
  await expect(deleteHistoricalWorkout(workoutId, db)).rejects.toThrow('Storage failure');
  expect(await detail()).toEqual(before);
});
it.each(['in_progress', 'abandoned'] as const)(
  'rejects history edit/detail/delete for %s Workouts',
  async (status) => {
    const before = await detail();
    await db.workouts.update(workoutId, { status });
    expect(await getHistoricalWorkout(workoutId, db)).toBeUndefined();
    await expect(
      saveHistoricalWorkout(workoutId, createHistoryDraft(before), db),
    ).rejects.toThrow();
    await expect(deleteHistoricalWorkout(workoutId, db)).rejects.toThrow();
    expect(await listCompletedWorkouts(db)).toEqual([]);
    expect(await getExerciseHistory(chest.id, db)).toEqual([]);
  },
);
it('queries stable Exercise identity across Circuits, renamed/deleted templates and mixed units newest first', async () => {
  await updateExercise(chest.id, { weightUnitOverride: 'kg', name: 'Renamed Chest Press' }, db);
  const other = await createCircuit(
    { name: 'Upper Body', description: '', exerciseIds: [chest.id] },
    db,
  );
  const newer = await record(other.id, '2026-10-22T10:00:00.000Z');
  const entries = await getExerciseHistory(chest.id, db);
  expect(
    entries.map((row) => [row.workout.id, row.workout.circuitName, row.exercise.weightUnit]),
  ).toEqual([
    [newer, 'Upper Body', 'kg'],
    [workoutId, 'Full Body', 'lb'],
  ]);
  const sameName = await createExercise(
    { name: 'Renamed Chest Press', notes: '', weightUnitOverride: null },
    db,
  );
  expect(await getExerciseHistory(sameName.id, db)).toEqual([]);
  await deleteExercise(chest.id, db);
  expect(await getExerciseHistory(chest.id, db)).toEqual(entries);
});
