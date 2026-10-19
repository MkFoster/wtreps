import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initializeDatabase, WtRepsDatabase } from './db.js';
import { APP_SETTINGS_ID } from '../domain/settings.js';
import {
  createExercise,
  deleteExercise,
  getExercise,
  listExercises,
  updateExercise,
} from './repositories/exerciseRepository.js';

let db: WtRepsDatabase;

beforeEach(() => {
  db = new WtRepsDatabase(`WtReps-test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  await db.delete();
});

describe('Version 1 database', () => {
  it('uses the stable production database name', () => {
    const production = new WtRepsDatabase();
    expect(production.name).toBe('WtReps');
    production.close();
  });

  it('opens schema version 2 with all nine tables and compound constraints', async () => {
    await db.open();
    expect(db.verno).toBe(2);
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      'appSettings',
      'circuitExercises',
      'circuits',
      'exerciseSettings',
      'exercises',
      'workoutExerciseSettings',
      'workoutExercises',
      'workoutSets',
      'workouts',
    ]);
    expect(db.circuitExercises.schema.idxByName['[circuitId+exerciseId]']?.unique).toBe(true);
    expect(db.workoutSets.schema.idxByName['[workoutExerciseId+position]']?.unique).toBe(true);
  });

  it('creates the documented default settings exactly once under concurrent initialization', async () => {
    await Promise.all([initializeDatabase(db), initializeDatabase(db)]);
    expect(await db.appSettings.count()).toBe(1);
    const settings = await db.appSettings.get(APP_SETTINGS_ID);
    expect(settings).toMatchObject({
      id: APP_SETTINGS_ID,
      weightUnit: 'lb',
      restTimerEnabled: false,
      defaultRestSeconds: 90,
      lastExportAt: null,
    });
    expect(settings?.createdAt).toBe(settings?.updatedAt);
    expect(new Date(settings!.createdAt).toISOString()).toBe(settings!.createdAt);
  });

  it('preserves preferences and timestamps when the database is reopened', async () => {
    await initializeDatabase(db);
    await db.appSettings.update(APP_SETTINGS_ID, {
      weightUnit: 'kg',
      lastExportAt: '2026-10-18T12:00:00.000Z',
    });
    const before = await db.appSettings.get(APP_SETTINGS_ID);
    db.close();
    await initializeDatabase(db);
    expect(await db.appSettings.get(APP_SETTINGS_ID)).toEqual(before);
  });

  it('repairs missing settings on an existing database without removing exercises', async () => {
    await initializeDatabase(db);
    await createExercise({ name: 'Row', notes: '', weightUnitOverride: null }, db);
    await db.appSettings.clear();
    await initializeDatabase(db);
    expect(await db.appSettings.count()).toBe(1);
    expect(await db.exercises.count()).toBe(1);
  });

  it('persists exercise CRUD across database connections', async () => {
    await initializeDatabase(db);
    const exercise = await createExercise(
      { name: ' Chest Press ', notes: '', weightUnitOverride: null },
      db,
    );
    expect(exercise.id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await listExercises(db))[0]?.name).toBe('Chest Press');
    await updateExercise(exercise.id, { notes: 'Neutral grip' }, db);
    const reopened = new WtRepsDatabase(db.name);
    try {
      await reopened.open();
      expect((await getExercise(exercise.id, reopened))?.notes).toBe('Neutral grip');
    } finally {
      reopened.close();
    }
    await deleteExercise(exercise.id, db);
    expect(await getExercise(exercise.id, db)).toBeUndefined();
  });

  it('rejects duplicate exercise membership and rolls back the transaction', async () => {
    await db.open();
    const now = new Date().toISOString();
    const membership = {
      circuitId: crypto.randomUUID(),
      exerciseId: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await expect(
      db.transaction('rw', db.circuitExercises, async () => {
        await db.circuitExercises.add({ ...membership, id: crypto.randomUUID(), position: 1 });
        await db.circuitExercises.add({ ...membership, id: crypto.randomUUID(), position: 2 });
      }),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
    expect(await db.circuitExercises.count()).toBe(0);
  });

  it('keeps template settings as text and enforces one setting per position', async () => {
    await initializeDatabase(db);
    const exercise = await createExercise({ name: 'Row', notes: '', weightUnitOverride: null }, db);
    const setting = {
      id: crypto.randomUUID(),
      exerciseId: exercise.id,
      position: 1,
      label: 'Back Pad',
      value: 'B',
      createdAt: exercise.createdAt,
      updatedAt: exercise.updatedAt,
    };
    await db.exerciseSettings.add(setting);
    expect((await db.exerciseSettings.get(setting.id))?.value).toBe('B');
    await expect(
      db.exerciseSettings.add({ ...setting, id: crypto.randomUUID() }),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
  });

  it('deletes exercise dependencies without deleting historical snapshots', async () => {
    await initializeDatabase(db);
    const exercise = await createExercise({ name: 'Row', notes: '', weightUnitOverride: null }, db);
    const metadata = { createdAt: exercise.createdAt, updatedAt: exercise.updatedAt };
    await db.exerciseSettings.add({
      ...metadata,
      id: crypto.randomUUID(),
      exerciseId: exercise.id,
      position: 1,
      label: 'Seat',
      value: '7',
    });
    await db.circuitExercises.add({
      ...metadata,
      id: crypto.randomUUID(),
      exerciseId: exercise.id,
      circuitId: crypto.randomUUID(),
      position: 1,
    });
    const snapshot = {
      ...metadata,
      id: crypto.randomUUID(),
      workoutId: crypto.randomUUID(),
      exerciseId: exercise.id,
      exerciseName: 'Row',
      exerciseNotes: '',
      position: 1,
      weightUnit: 'lb' as const,
    };
    await db.workoutExercises.add(snapshot);
    await deleteExercise(exercise.id, db);
    expect(await db.exercises.count()).toBe(0);
    expect(await db.exerciseSettings.count()).toBe(0);
    expect(await db.circuitExercises.count()).toBe(0);
    expect(await db.workoutExercises.get(snapshot.id)).toEqual(snapshot);
  });
});
