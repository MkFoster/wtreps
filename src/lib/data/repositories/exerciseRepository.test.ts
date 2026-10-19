import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WtRepsDatabase, initializeDatabase } from '../db.js';
import {
  createExercise,
  deleteExercise,
  getExerciseCircuits,
  getExerciseDetails,
  listExercises,
  listExerciseDetails,
  updateExercise,
} from './exerciseRepository.js';
import { newExerciseForm, summarizeSettings } from '../../domain/exerciseForm.js';
import { newRecordMetadata } from '../../utils/records.js';
import type { ExerciseInput } from '../../domain/exercise.js';

let db: WtRepsDatabase;
const input = (name = 'Chest Press'): ExerciseInput => ({
  name,
  notes: 'Neutral grip',
  weightUnitOverride: null,
  settings: [
    { position: 1, label: ' Seat ', value: ' 7 ' },
    { position: 2, label: 'Handle Position', value: '3' },
  ],
});

beforeEach(async () => {
  db = new WtRepsDatabase(`WtReps-exercises-${crypto.randomUUID()}`);
  await initializeDatabase(db);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});

describe('exercise management', () => {
  it('defaults a fresh form to an empty name and Seat with an empty text value', () => {
    const form = newExerciseForm();
    expect(form).toEqual({
      name: '',
      notes: '',
      weightUnitOverride: null,
      settings: [{ position: 1, label: 'Seat', value: '' }],
    });
    form.settings[0]!.value = '7';
    expect(newExerciseForm().settings[0]!.value).toBe('');
  });

  it('creates an exercise and trimmed settings with UUIDs and UTC metadata', async () => {
    const exercise = await createExercise(input(' Chest Press '), db);
    const details = await getExerciseDetails(exercise.id, db);
    expect(details?.exercise).toMatchObject({
      name: 'Chest Press',
      notes: 'Neutral grip',
      weightUnitOverride: null,
    });
    expect(
      details?.settings.map(({ position, label, value }) => ({ position, label, value })),
    ).toEqual([
      { position: 1, label: 'Seat', value: '7' },
      { position: 2, label: 'Handle Position', value: '3' },
    ]);
    for (const row of [exercise, ...details!.settings]) {
      expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(new Date(row.createdAt).toISOString()).toBe(row.createdAt);
    }
  });

  it('omits incomplete and whitespace-only rows while preserving explicit positions', async () => {
    const exercise = await createExercise(
      {
        ...input(),
        settings: [
          { position: 1, label: 'Seat', value: ' ' },
          { position: 2, label: ' ', value: '7' },
          { position: 3, label: 'Back Pad', value: ' B ' },
          { position: 4, label: 'ROM', value: 'Middle' },
        ],
      },
      db,
    );
    expect(
      (await getExerciseDetails(exercise.id, db))?.settings.map((row) => [
        row.position,
        row.label,
        row.value,
      ]),
    ).toEqual([
      [3, 'Back Pad', 'B'],
      [4, 'ROM', 'Middle'],
    ]);
  });

  it('allows five settings and rejects six before persisting anything', async () => {
    const settings = Array.from({ length: 5 }, (_, index) => ({
      position: index + 1,
      label: `Label ${index}`,
      value: 'High',
    }));
    const exercise = await createExercise({ ...input(), settings }, db);
    expect((await getExerciseDetails(exercise.id, db))?.settings).toHaveLength(5);
    await expect(
      createExercise(
        { ...input(), settings: [...settings, { position: 6, label: 'Sixth', value: '3' }] },
        db,
      ),
    ).rejects.toThrow('five');
    expect(await db.exercises.count()).toBe(1);
    expect(await db.exerciseSettings.count()).toBe(5);
  });

  it('validates names, units, lengths, and setting positions', async () => {
    for (const name of ['', '   ', 'x'.repeat(101)]) {
      await expect(createExercise(input(name), db)).rejects.toThrow('name');
    }
    await expect(
      createExercise({ ...input(), weightUnitOverride: 'stone' as 'kg' }, db),
    ).rejects.toThrow('unit');
    for (const position of [0, 6, 1.5]) {
      await expect(
        createExercise({ ...input(), settings: [{ position, label: 'Seat', value: '1' }] }, db),
      ).rejects.toThrow('position');
    }
    await expect(
      createExercise(
        { ...input(), settings: [{ position: 1, label: 'x'.repeat(51), value: '1' }] },
        db,
      ),
    ).rejects.toThrow('50');
    expect(await db.exercises.count()).toBe(0);
  });

  it('updates fields and replaces settings atomically, retaining IDs, timestamps and positions', async () => {
    const exercise = await createExercise(input(), db);
    const old = (await getExerciseDetails(exercise.id, db))!.settings;
    await updateExercise(
      exercise.id,
      {
        name: 'Chest Press A',
        notes: 'Slowly',
        weightUnitOverride: 'kg',
        settings: [
          { ...old[0]!, value: '8' },
          { ...old[1]!, value: ' ' },
          { position: 5, label: 'ROM', value: 'Middle' },
        ],
      },
      db,
    );
    const details = (await getExerciseDetails(exercise.id, db))!;
    expect(details.exercise).toMatchObject({
      name: 'Chest Press A',
      notes: 'Slowly',
      weightUnitOverride: 'kg',
      createdAt: exercise.createdAt,
    });
    expect(details.settings.map((row) => [row.position, row.label, row.value])).toEqual([
      [1, 'Seat', '8'],
      [5, 'ROM', 'Middle'],
    ]);
    expect(details.settings[0]).toMatchObject({ id: old[0]!.id, createdAt: old[0]!.createdAt });
    expect(await db.exerciseSettings.get(old[1]!.id)).toBeUndefined();
  });

  it('rolls back creation when a settings write fails', async () => {
    const spy = vi
      .spyOn(db.exerciseSettings, 'bulkAdd')
      .mockRejectedValueOnce(new Error('Storage failure'));
    await expect(createExercise(input(), db)).rejects.toThrow('Storage failure');
    spy.mockRestore();
    expect(await db.exercises.count()).toBe(0);
    expect(await db.exerciseSettings.count()).toBe(0);
  });

  it('rolls back the exercise and all settings when an update fails', async () => {
    const exercise = await createExercise(input(), db);
    const before = await getExerciseDetails(exercise.id, db);
    const spy = vi
      .spyOn(db.exerciseSettings, 'bulkAdd')
      .mockRejectedValueOnce(new Error('Storage failure'));
    await expect(
      updateExercise(
        exercise.id,
        { name: 'Changed', settings: [{ position: 4, label: 'Seat', value: '8' }] },
        db,
      ),
    ).rejects.toThrow('Storage failure');
    spy.mockRestore();
    expect(await getExerciseDetails(exercise.id, db)).toEqual(before);
  });

  it('cannot overwrite another exercise setting or recreate a deleted exercise', async () => {
    const first = await createExercise(input(), db);
    const second = await createExercise(input('Row'), db);
    const foreign = (await getExerciseDetails(second.id, db))!.settings[0]!;
    const before = await getExerciseDetails(first.id, db);
    await expect(
      updateExercise(first.id, { name: 'Changed', settings: [foreign] }, db),
    ).rejects.toThrow('belongs');
    expect(await getExerciseDetails(first.id, db)).toEqual(before);
    await deleteExercise(first.id, db);
    await expect(updateExercise(first.id, { name: 'Recreated' }, db)).rejects.toThrow(
      'does not exist',
    );
  });

  it('lists names alphabetically regardless of case and summarizes two settings', async () => {
    for (const name of ['Seated Row', 'leg Press', 'Chest Press'])
      await createExercise(input(name), db);
    expect((await listExercises(db)).map((row) => row.name)).toEqual([
      'Chest Press',
      'leg Press',
      'Seated Row',
    ]);
    const list = await listExerciseDetails(db);
    expect(list.map((row) => row.exercise.name)).toEqual([
      'Chest Press',
      'leg Press',
      'Seated Row',
    ]);
    expect(
      summarizeSettings([
        ...list[0]!.settings,
        { label: 'ROM', value: 'High' },
        { label: 'Back Pad', value: 'B' },
      ]),
    ).toBe('Seat 7 · Handle Position 3 · +2 more');
  });

  it('detects named circuits, deletes only template dependencies and preserves all historical data', async () => {
    const exercise = await createExercise(input(), db);
    const other = await createExercise(input('Leg Press'), db);
    const [seat] = (await getExerciseDetails(exercise.id, db))!.settings;
    for (const name of ['Upper Body', 'Full Body']) {
      const circuit = { ...newRecordMetadata(), name, description: '' };
      await db.circuits.add(circuit);
      await db.circuitExercises.add({
        ...newRecordMetadata(),
        circuitId: circuit.id,
        exerciseId: exercise.id,
        position: 1,
      });
      await db.circuitExercises.add({
        ...newRecordMetadata(),
        circuitId: circuit.id,
        exerciseId: other.id,
        position: 2,
      });
    }
    const workout = {
      ...newRecordMetadata(),
      circuitId: crypto.randomUUID(),
      circuitName: 'Old Circuit',
      status: 'completed' as const,
      currentExercisePosition: 1,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    const historicalExercise = {
      ...newRecordMetadata(),
      workoutId: workout.id,
      exerciseId: exercise.id,
      exerciseName: 'Original Chest Press',
      exerciseNotes: '',
      position: 1,
      weightUnit: 'lb' as const,
    };
    const historicalSetting = {
      ...newRecordMetadata(),
      workoutExerciseId: historicalExercise.id,
      sourceExerciseSettingId: seat!.id,
      position: 1,
      label: 'Seat',
      value: '7',
    };
    const historicalSet = {
      ...newRecordMetadata(),
      workoutExerciseId: historicalExercise.id,
      position: 1,
      weight: 100,
      reps: 12,
      isCompleted: true,
      completedAt: new Date().toISOString(),
    };
    await db.workouts.add(workout);
    await db.workoutExercises.add(historicalExercise);
    await db.workoutExerciseSettings.add(historicalSetting);
    await db.workoutSets.add(historicalSet);
    expect((await getExerciseCircuits(exercise.id, db)).map((row) => row.name)).toEqual([
      'Full Body',
      'Upper Body',
    ]);
    await updateExercise(
      exercise.id,
      { name: 'Renamed', settings: [{ ...seat!, value: '8' }] },
      db,
    );
    expect(await db.workoutExerciseSettings.get(historicalSetting.id)).toEqual(historicalSetting);
    await deleteExercise(exercise.id, db);
    expect(await getExerciseDetails(exercise.id, db)).toBeUndefined();
    expect(await db.exerciseSettings.where('exerciseId').equals(exercise.id).count()).toBe(0);
    expect(await db.circuitExercises.where('exerciseId').equals(exercise.id).count()).toBe(0);
    expect(await db.circuitExercises.where('exerciseId').equals(other.id).count()).toBe(2);
    expect(await db.circuits.count()).toBe(2);
    expect(await db.workouts.get(workout.id)).toEqual(workout);
    expect(await db.workoutExercises.get(historicalExercise.id)).toEqual(historicalExercise);
    expect(await db.workoutExerciseSettings.get(historicalSetting.id)).toEqual(historicalSetting);
    expect(await db.workoutSets.get(historicalSet.id)).toEqual(historicalSet);
  });

  it('rolls back template deletions when the parent deletion fails', async () => {
    const exercise = await createExercise(input(), db);
    await db.circuitExercises.add({
      ...newRecordMetadata(),
      circuitId: crypto.randomUUID(),
      exerciseId: exercise.id,
      position: 1,
    });
    const before = await getExerciseDetails(exercise.id, db);
    vi.spyOn(db.exercises, 'delete').mockRejectedValueOnce(new Error('Storage failure'));
    await expect(deleteExercise(exercise.id, db)).rejects.toThrow('Storage failure');
    expect(await getExerciseDetails(exercise.id, db)).toEqual(before);
    expect(await db.circuitExercises.where('exerciseId').equals(exercise.id).count()).toBe(1);
  });
});
