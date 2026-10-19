import { createDefaultSettings } from '../lib/domain/settings.js';
import type { Backup } from '../lib/validation/exportSchema.js';

export function backupFixture(): Backup {
  const now = '2026-10-19T10:00:00.000Z';
  const meta = () => ({ id: crypto.randomUUID(), createdAt: now, updatedAt: now });
  const chest = {
    ...meta(),
    name: 'Imported Chest Press',
    notes: 'Neutral grip',
    weightUnitOverride: null,
  };
  const leg = {
    ...meta(),
    name: 'Imported Leg Press',
    notes: '',
    weightUnitOverride: 'lb' as const,
  };
  const circuit = { ...meta(), name: 'Imported Full Body', description: '' };
  const workouts = (['completed', 'abandoned', 'in_progress'] as const).map((status) => ({
    ...meta(),
    circuitId: crypto.randomUUID(),
    circuitName: status === 'in_progress' ? 'Restored Active Circuit' : 'Historical Circuit',
    status,
    currentExercisePosition: status === 'in_progress' ? 2 : 1,
    startedAt: now,
    completedAt: status === 'in_progress' ? null : '2026-10-19T10:47:00.000Z',
  }));
  const workoutExercises = workouts.flatMap((workout) =>
    [1, 2].map((position) => ({
      ...meta(),
      workoutId: workout.id,
      exerciseId: position === 1 ? crypto.randomUUID() : leg.id,
      exerciseName: position === 1 ? 'Historical Chest Press' : 'Historical Leg Press',
      exerciseNotes: '',
      position,
      weightUnit: 'kg' as const,
    })),
  );
  return {
    schemaVersion: 2,
    exportedAt: now,
    appSettings: { ...createDefaultSettings(now), weightUnit: 'kg' },
    exercises: [chest, leg],
    exerciseSettings: [{ ...meta(), exerciseId: chest.id, position: 1, label: 'Seat', value: '7' }],
    circuits: [circuit],
    circuitExercises: [
      { ...meta(), circuitId: circuit.id, exerciseId: chest.id, position: 1 },
      { ...meta(), circuitId: circuit.id, exerciseId: leg.id, position: 3 },
    ],
    workouts,
    workoutExercises,
    workoutExerciseSettings: workoutExercises.map((row) => ({
      ...meta(),
      workoutExerciseId: row.id,
      sourceExerciseSettingId: crypto.randomUUID(),
      position: 1,
      label: 'Seat',
      value: 'B',
    })),
    workoutSets: workoutExercises.map((row, index) => ({
      ...meta(),
      workoutExerciseId: row.id,
      position: 1,
      weight: index < 4 ? 100 : null,
      reps: index < 4 ? 12 : null,
      isCompleted: index < 4,
      completedAt: index < 4 ? now : null,
    })),
  };
}
