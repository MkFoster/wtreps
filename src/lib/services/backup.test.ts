import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initializeDatabase, WtRepsDatabase } from '../data/db.js';
import {
  backupSchema,
  validateBackup,
  BackupValidationError,
  type Backup,
} from '../validation/exportSchema.js';
import { backupFixture } from '../../test/backupFixture.js';
import { importData, parseBackup, readBackupFile } from './importData.js';
import { exportData, exportBackup, backupFilename, downloadBackup } from './exportData.js';
import { APP_SETTINGS_ID } from '../domain/settings.js';
import { getHomeData } from '../data/repositories/homeRepository.js';
import { getWorkoutEntry } from '../data/repositories/workoutRepository.js';
import { updateWeightUnit } from '../data/repositories/settingsRepository.js';
import { startWorkout } from './startWorkout.js';
import { abandonWorkout } from './abandonWorkout.js';

let db: WtRepsDatabase;
let backup: Backup;
beforeEach(async () => {
  db = new WtRepsDatabase(`WtReps-backup-${crypto.randomUUID()}`);
  await initializeDatabase(db);
  backup = backupFixture();
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await db.delete();
});
async function stored() {
  return db.transaction('r', db.tables, async () =>
    Object.fromEntries(
      await Promise.all(db.tables.map(async (table) => [table.name, await table.toArray()])),
    ),
  );
}

it('accepts the complete v2 envelope, gaps, nulls and deleted-template source references', () => {
  expect(validateBackup(backup)).toEqual(backup);
  expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  expect(backupSchema.safeParse(backup).success).toBe(true);
});
it('rejects invalid JSON and failed file reads before touching data', async () => {
  const before = await stored();
  expect(() => parseBackup('{invalid')).toThrow(BackupValidationError);
  await expect(
    readBackupFile({
      text: async () => {
        throw new Error('File read failed');
      },
    }),
  ).rejects.toThrow();
  expect(await stored()).toEqual(before);
});
it.each([0, 1, -1, 2.5, '2', null])('rejects unsupported/invalid version %j', (schemaVersion) => {
  expect(() => validateBackup({ ...backup, schemaVersion })).toThrow(BackupValidationError);
});
it('distinguishes newer backup versions', () => {
  try {
    validateBackup({ ...backup, schemaVersion: 3 });
    throw new Error('Should reject');
  } catch (cause) {
    expect(cause).toBeInstanceOf(BackupValidationError);
    expect((cause as BackupValidationError).newerVersion).toBe(true);
  }
});

const invalidCases: [string, (value: Backup) => void][] = [
  [
    'duplicate Exercise IDs',
    (b) => {
      b.exercises.push({ ...b.exercises[0]! });
    },
  ],
  [
    'duplicate Set IDs',
    (b) => {
      b.workoutSets.push({ ...b.workoutSets[0]!, position: 2 });
    },
  ],
  [
    'missing Circuit',
    (b) => {
      b.circuitExercises[0]!.circuitId = crypto.randomUUID();
    },
  ],
  [
    'missing Circuit Exercise',
    (b) => {
      b.circuitExercises[0]!.exerciseId = crypto.randomUUID();
    },
  ],
  [
    'missing setting Exercise',
    (b) => {
      b.exerciseSettings[0]!.exerciseId = crypto.randomUUID();
    },
  ],
  [
    'missing Workout',
    (b) => {
      b.workoutExercises[0]!.workoutId = crypto.randomUUID();
    },
  ],
  [
    'missing Set parent',
    (b) => {
      b.workoutSets[0]!.workoutExerciseId = crypto.randomUUID();
    },
  ],
  [
    'missing snapshot setting parent',
    (b) => {
      b.workoutExerciseSettings[0]!.workoutExerciseId = crypto.randomUUID();
    },
  ],
  [
    'multiple active Workouts',
    (b) => {
      b.workouts[0]!.status = 'in_progress';
      b.workouts[0]!.completedAt = null;
    },
  ],
  [
    'invalid current position',
    (b) => {
      b.workouts[2]!.currentExercisePosition = 3;
    },
  ],
  [
    'invalid machine position',
    (b) => {
      b.exerciseSettings[0]!.position = 6;
    },
  ],
  [
    'duplicate membership',
    (b) => {
      b.circuitExercises[1]!.exerciseId = b.circuitExercises[0]!.exerciseId;
    },
  ],
  [
    'duplicate snapshot position',
    (b) => {
      b.workoutExercises[1]!.position = 1;
    },
  ],
  [
    'duplicate Set position',
    (b) => {
      b.workoutSets.push({ ...b.workoutSets[0]!, id: crypto.randomUUID() });
    },
  ],
  [
    'invalid Set position',
    (b) => {
      b.workoutSets[0]!.position = 0;
    },
  ],
  [
    'fractional reps',
    (b) => {
      b.workoutSets[0]!.reps = 1.5;
    },
  ],
  [
    'completed Set without weight',
    (b) => {
      b.workoutSets[0]!.weight = null;
    },
  ],
  [
    'negative weight',
    (b) => {
      b.workoutSets[0]!.weight = -1;
    },
  ],
  [
    'wrong settings ID',
    (b) => {
      Object.assign(b.appSettings, { id: crypto.randomUUID() });
    },
  ],
  [
    'invalid unit',
    (b) => {
      Object.assign(b.workoutExercises[0]!, { weightUnit: 'oz' });
    },
  ],
  [
    'invalid status',
    (b) => {
      Object.assign(b.workouts[0]!, { status: 'paused' });
    },
  ],
  [
    'invalid timestamp',
    (b) => {
      b.exportedAt = 'yesterday';
    },
  ],
  [
    'missing collection',
    (b) => {
      Reflect.deleteProperty(b, 'workoutSets');
    },
  ],
  [
    'settings array',
    (b) => {
      Object.assign(b, { appSettings: [b.appSettings] });
    },
  ],
];
it.each(invalidCases)('rejects %s without changing original data', async (_name, change) => {
  const before = await stored();
  change(backup);
  expect(() => validateBackup(backup)).toThrow(BackupValidationError);
  await expect(importData(backup, db)).rejects.toThrow(BackupValidationError);
  expect(await stored()).toEqual(before);
});
it('rejects a data wrapper and unknown envelope properties', () => {
  expect(() =>
    validateBackup({ schemaVersion: 2, exportedAt: backup.exportedAt, data: backup }),
  ).toThrow();
  expect(() => validateBackup({ ...backup, unexpected: true })).toThrow();
});
it('exports every table preserving IDs, timestamps, snapshots, units, nulls, status and resume position', async () => {
  await importData(backup, db);
  const result = await exportData(db);
  expect(Object.keys(result).sort()).toEqual(Object.keys(backup).sort());
  for (const key of Object.keys(backup) as (keyof Backup)[]) {
    if (key === 'exportedAt') continue;
    const expected = backup[key],
      actual = result[key];
    if (Array.isArray(expected) && Array.isArray(actual)) {
      expect([...actual].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
        [...expected].sort((a, b) => a.id.localeCompare(b.id)),
      );
    } else expect(actual).toEqual(expected);
  }
  expect(validateBackup(result)).toEqual(result);
  expect((await db.appSettings.get(APP_SETTINGS_ID))!.lastExportAt).toBeNull();
});
it('exports one consistent state while a multi-table change is queued', async () => {
  await importData(backup, db);
  const [result] = await Promise.all([
    exportData(db),
    db.transaction('rw', [db.exercises, db.exerciseSettings], async () => {
      await db.exercises.update(backup.exercises[0]!.id, { name: 'Changed' });
      await db.exerciseSettings.update(backup.exerciseSettings[0]!.id, { value: '8' });
    }),
  ]);
  const exercise = result.exercises.find((row) => row.id === backup.exercises[0]!.id)!;
  expect([exercise.name, result.exerciseSettings[0]!.value]).toEqual(['Imported Chest Press', '7']);
});
it('updates lastExportAt only after export initiation, preserving the exported settings snapshot', async () => {
  await importData(backup, db);
  const offer = vi.fn(async (data: Backup) => {
    expect(data.appSettings.lastExportAt).toBeNull();
    expect((await db.appSettings.get(APP_SETTINGS_ID))!.lastExportAt).toBeNull();
  });
  await exportBackup(db, offer);
  expect(offer).toHaveBeenCalledOnce();
  expect((await db.appSettings.get(APP_SETTINGS_ID))!.lastExportAt).toMatch(/Z$/);
});
it('does not mark export when offering the file fails or generated data is invalid', async () => {
  await expect(
    exportBackup(db, async () => {
      throw new Error('Download failed');
    }),
  ).rejects.toThrow();
  expect((await db.appSettings.get(APP_SETTINGS_ID))!.lastExportAt).toBeNull();
  await db.appSettings.clear();
  const offer = vi.fn();
  await expect(exportBackup(db, offer)).rejects.toThrow();
  expect(offer).not.toHaveBeenCalled();
});
it('uses the local calendar date in the filename', () => {
  expect(backupFilename(new Date(2026, 0, 2, 23, 59))).toBe('wtreps-backup-2026-01-02.json');
});
it('initiates a Blob download and revokes its temporary URL', () => {
  vi.useFakeTimers();
  const click = vi.fn(),
    remove = vi.fn();
  const anchor = { href: '', download: '', click, remove };
  vi.stubGlobal('document', { createElement: () => anchor, body: { append: vi.fn() } });
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  downloadBackup(backup);
  expect(create.mock.calls[0]![0]).toBeInstanceOf(Blob);
  expect(anchor.download).toMatch(/^wtreps-backup-\d{4}-\d{2}-\d{2}\.json$/);
  expect(click).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledOnce();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith('blob:backup');
});
it('replaces all old data and restores AppSettings and the active Workout exactly', async () => {
  const old = { ...backup.exercises[0]!, id: crypto.randomUUID(), name: 'Old Exercise' };
  await db.exercises.add(old);
  await importData(backup, db);
  expect(await db.exercises.get(old.id)).toBeUndefined();
  expect(await db.appSettings.toArray()).toEqual([backup.appSettings]);
  const active = (await getHomeData(db)).active!;
  expect(active.workout).toEqual(backup.workouts[2]);
  expect(active.currentExerciseNumber).toBe(2);
  expect((await getWorkoutEntry(active.workout.id, db))!.current?.exerciseName).toBe(
    'Historical Leg Press',
  );
  await initializeDatabase(db);
  expect(await db.appSettings.get(APP_SETTINGS_ID)).toEqual(backup.appSettings);
});
it('removes the old active Workout when imported data has none', async () => {
  await importData(backup, db);
  const replacement = backupFixture();
  replacement.workouts = [];
  replacement.workoutExercises = [];
  replacement.workoutExerciseSettings = [];
  replacement.workoutSets = [];
  await importData(replacement, db);
  expect((await getHomeData(db)).active).toBeUndefined();
});
it('rolls back all clears/inserts on a write failure late in replacement', async () => {
  await importData(backup, db);
  const before = await stored();
  vi.spyOn(db.appSettings, 'add').mockRejectedValueOnce(new Error('Storage failure'));
  await expect(importData(backupFixture(), db)).rejects.toThrow('Storage failure');
  expect(await stored()).toEqual(before);
});
it('changes only the default unit and uses it for future snapshots without changing overrides/history', async () => {
  await importData(backup, db);
  const before = await stored();
  await updateWeightUnit('lb', db);
  expect(await db.exercises.toArray()).toEqual(before.exercises);
  expect(await db.workoutExercises.toArray()).toEqual(before.workoutExercises);
  await abandonWorkout(backup.workouts[2]!.id, db);
  const next = await startWorkout(backup.circuits[0]!.id, db);
  const rows = await db.workoutExercises.where('workoutId').equals(next.id).sortBy('position');
  expect(rows.map((row) => row.weightUnit)).toEqual(['lb', 'lb']);
});
