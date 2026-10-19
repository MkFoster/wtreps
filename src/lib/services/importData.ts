import { getDatabase } from '../data/db.js';
import { BackupValidationError, validateBackup, type Backup } from '../validation/exportSchema.js';

export function parseBackup(text: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupValidationError();
  }
  return validateBackup(parsed);
}
export async function readBackupFile(file: Pick<File, 'text'>) {
  return parseBackup(await file.text());
}

// Called only after the UI obtains explicit replacement confirmation. Revalidate at
// the write boundary so a mutated/passed object can never bypass validation.
export async function importData(input: unknown, db = getDatabase()) {
  const backup = validateBackup(input);
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
    await db.exercises.bulkAdd(backup.exercises);
    await db.exerciseSettings.bulkAdd(backup.exerciseSettings);
    await db.circuits.bulkAdd(backup.circuits);
    await db.circuitExercises.bulkAdd(backup.circuitExercises);
    await db.workouts.bulkAdd(backup.workouts);
    await db.workoutExercises.bulkAdd(backup.workoutExercises);
    await db.workoutExerciseSettings.bulkAdd(backup.workoutExerciseSettings);
    await db.workoutSets.bulkAdd(backup.workoutSets);
    await db.appSettings.add(backup.appSettings);
  });
}
