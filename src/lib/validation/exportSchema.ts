import { z } from 'zod';

export const exportHeaderSchema = z.object({
  schemaVersion: z.literal(2),
  exportedAt: z.iso.datetime(),
});

const timestamp = z.iso.datetime();
const id = z.uuid();
const position = z.number().int().positive();
const unit = z.enum(['lb', 'kg']);
const text = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => value.trim().length > 0);
const metadata = { id, createdAt: timestamp, updatedAt: timestamp };
const machineSetting = { position: position.max(5), label: text(50), value: text(100) };
const appSettings = z.strictObject({
  ...metadata,
  id: z.literal('app-settings'),
  weightUnit: unit,
  restTimerEnabled: z.boolean(),
  defaultRestSeconds: z.number().int().nonnegative(),
  lastExportAt: timestamp.nullable(),
});
const exercise = z.strictObject({
  ...metadata,
  name: text(100),
  notes: z.string(),
  weightUnitOverride: unit.nullable(),
});
const exerciseSetting = z.strictObject({ ...metadata, ...machineSetting, exerciseId: id });
const circuit = z.strictObject({ ...metadata, name: text(100), description: z.string() });
const circuitExercise = z.strictObject({ ...metadata, circuitId: id, exerciseId: id, position });
const workout = z
  .strictObject({
    ...metadata,
    circuitId: id,
    circuitName: text(100),
    status: z.enum(['in_progress', 'completed', 'abandoned']),
    currentExercisePosition: position,
    startedAt: timestamp,
    completedAt: timestamp.nullable(),
  })
  .refine((row) => (row.status === 'in_progress') === (row.completedAt === null));
const workoutExercise = z.strictObject({
  ...metadata,
  workoutId: id,
  exerciseId: id,
  exerciseName: text(100),
  exerciseNotes: z.string(),
  position,
  weightUnit: unit,
});
const workoutExerciseSetting = z.strictObject({
  ...metadata,
  ...machineSetting,
  workoutExerciseId: id,
  sourceExerciseSettingId: id,
});
const workoutSet = z
  .strictObject({
    ...metadata,
    workoutExerciseId: id,
    position,
    weight: z.number().nonnegative().nullable(),
    reps: z.number().int().nonnegative().nullable(),
    isCompleted: z.boolean(),
    completedAt: timestamp.nullable(),
  })
  .refine((row) =>
    row.isCompleted
      ? row.weight !== null && row.reps !== null && row.completedAt !== null
      : row.completedAt === null,
  );

export const backupSchema = z
  .strictObject({
    schemaVersion: z.literal(2),
    exportedAt: timestamp,
    appSettings,
    exercises: z.array(exercise),
    exerciseSettings: z.array(exerciseSetting),
    circuits: z.array(circuit),
    circuitExercises: z.array(circuitExercise),
    workouts: z.array(workout),
    workoutExercises: z.array(workoutExercise),
    workoutExerciseSettings: z.array(workoutExerciseSetting),
    workoutSets: z.array(workoutSet),
  })
  .superRefine((backup, context) => {
    const issue = (message: string) => context.addIssue({ code: 'custom', message });
    const collections = [
      backup.exercises,
      backup.exerciseSettings,
      backup.circuits,
      backup.circuitExercises,
      backup.workouts,
      backup.workoutExercises,
      backup.workoutExerciseSettings,
      backup.workoutSets,
    ];
    for (const rows of collections) {
      if (new Set(rows.map((row) => row.id)).size !== rows.length) issue('Duplicate record IDs.');
    }
    const exercises = new Set(backup.exercises.map((row) => row.id));
    const circuits = new Set(backup.circuits.map((row) => row.id));
    const workouts = new Set(backup.workouts.map((row) => row.id));
    const snapshots = new Set(backup.workoutExercises.map((row) => row.id));
    for (const row of backup.exerciseSettings)
      if (!exercises.has(row.exerciseId)) issue('Missing setting Exercise.');
    for (const row of backup.circuitExercises)
      if (!circuits.has(row.circuitId) || !exercises.has(row.exerciseId))
        issue('Missing Circuit membership template.');
    for (const row of backup.workoutExercises)
      if (!workouts.has(row.workoutId)) issue('Missing Workout.');
    for (const row of [...backup.workoutExerciseSettings, ...backup.workoutSets])
      if (!snapshots.has(row.workoutExerciseId)) issue('Missing WorkoutExercise.');
    const unique = <T>(rows: T[], key: (row: T) => string) => {
      if (new Set(rows.map(key)).size !== rows.length) issue('Duplicate membership or position.');
    };
    unique(backup.exerciseSettings, (row) => `${row.exerciseId}:${row.position}`);
    unique(backup.circuitExercises, (row) => `${row.circuitId}:${row.position}`);
    unique(backup.circuitExercises, (row) => `${row.circuitId}:${row.exerciseId}`);
    unique(backup.workoutExercises, (row) => `${row.workoutId}:${row.position}`);
    unique(backup.workoutExerciseSettings, (row) => `${row.workoutExerciseId}:${row.position}`);
    unique(backup.workoutSets, (row) => `${row.workoutExerciseId}:${row.position}`);
    if (backup.workouts.filter((row) => row.status === 'in_progress').length > 1)
      issue('Multiple active Workouts.');
    const snapshotPositions = new Map<string, Set<number>>();
    for (const row of backup.workoutExercises) {
      const positions = snapshotPositions.get(row.workoutId) ?? new Set<number>();
      positions.add(row.position);
      snapshotPositions.set(row.workoutId, positions);
    }
    for (const row of backup.workouts) {
      const positions = snapshotPositions.get(row.id);
      if (
        positions?.size
          ? !positions.has(row.currentExercisePosition)
          : row.currentExercisePosition !== 1
      )
        issue('Invalid current Exercise position.');
    }
  });
export type Backup = z.infer<typeof backupSchema>;

export class BackupValidationError extends Error {
  constructor(readonly newerVersion = false) {
    super(
      newerVersion
        ? 'This backup was created by a newer version of WtReps. Update WtReps and try again.'
        : 'This file is not a valid WtReps backup or uses an unsupported format.',
    );
  }
}
export function validateBackup(input: unknown): Backup {
  if (
    typeof input === 'object' &&
    input !== null &&
    'schemaVersion' in input &&
    typeof input.schemaVersion === 'number' &&
    Number.isInteger(input.schemaVersion) &&
    input.schemaVersion > 2
  )
    throw new BackupValidationError(true);
  const result = backupSchema.safeParse(input);
  if (!result.success) throw new BackupValidationError();
  return result.data;
}
