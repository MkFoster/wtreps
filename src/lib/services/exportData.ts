import { getDatabase } from '../data/db.js';
import { APP_SETTINGS_ID } from '../domain/settings.js';
import { validateBackup, type Backup } from '../validation/exportSchema.js';

export function exportData(db = getDatabase()): Promise<Backup> {
  return db.transaction('r', db.tables, async () => {
    const settings = await db.appSettings.toArray();
    if (settings.length !== 1) throw new Error('Expected one AppSettings record.');
    return validateBackup({
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      appSettings: settings[0],
      exercises: await db.exercises.toArray(),
      exerciseSettings: await db.exerciseSettings.toArray(),
      circuits: await db.circuits.toArray(),
      circuitExercises: await db.circuitExercises.toArray(),
      workouts: await db.workouts.toArray(),
      workoutExercises: await db.workoutExercises.toArray(),
      workoutExerciseSettings: await db.workoutExerciseSettings.toArray(),
      workoutSets: await db.workoutSets.toArray(),
    });
  });
}

export function backupFilename(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `wtreps-backup-${date.getFullYear()}-${month}-${day}.json`;
}

export function downloadBackup(backup: Backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = backupFilename();
  try {
    document.body.append(anchor);
    anchor.click();
  } catch (cause) {
    URL.revokeObjectURL(url);
    throw cause;
  } finally {
    anchor.remove();
  }
  // Give Safari/download handlers time to consume the URL before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function exportBackup(
  db = getDatabase(),
  offer: (backup: Backup) => void | Promise<void> = downloadBackup,
) {
  const backup = await exportData(db);
  await offer(backup);
  const now = new Date().toISOString();
  if (!(await db.appSettings.update(APP_SETTINGS_ID, { lastExportAt: now, updatedAt: now })))
    throw new Error('Backup initiated but its timestamp could not be saved.');
  return backup;
}
