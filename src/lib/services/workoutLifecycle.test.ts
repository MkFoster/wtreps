import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeDatabase, WtRepsDatabase } from '../data/db.js';
import {
  createExercise,
  deleteExercise,
  getExerciseDetails,
  updateExercise,
} from '../data/repositories/exerciseRepository.js';
import {
  createCircuit,
  deleteCircuit,
  updateCircuit,
} from '../data/repositories/circuitRepository.js';
import {
  getActiveWorkout,
  getPreviousCompletedSets,
  getWorkoutHistory,
  getWorkoutOverview,
  listWorkoutExercises,
} from '../data/repositories/workoutRepository.js';
import { getHomeData } from '../data/repositories/homeRepository.js';
import { APP_SETTINGS_ID } from '../domain/settings.js';
import {
  ActiveWorkoutExistsError,
  type Workout,
  type WorkoutExercise,
  type WorkoutStatus,
} from '../domain/workout.js';
import type { Exercise } from '../domain/exercise.js';
import type { Circuit } from '../domain/circuit.js';
import { newRecordMetadata } from '../utils/records.js';
import { startWorkout } from './startWorkout.js';
import { abandonWorkout } from './abandonWorkout.js';

let db: WtRepsDatabase;
let chest: Exercise;
let leg: Exercise;
let circuit: Circuit;
beforeEach(async () => {
  db = new WtRepsDatabase(`WtReps-workouts-${crypto.randomUUID()}`);
  await initializeDatabase(db);
  chest = await createExercise(
    {
      name: 'Chest Press',
      notes: 'Neutral grip',
      weightUnitOverride: null,
      settings: [
        { position: 1, label: 'Seat', value: '7' },
        { position: 3, label: 'Handle', value: 'Middle' },
      ],
    },
    db,
  );
  leg = await createExercise(
    {
      name: 'Leg Press',
      notes: 'Keep knees soft',
      weightUnitOverride: 'kg',
      settings: [{ position: 2, label: 'Back Pad', value: 'B' }],
    },
    db,
  );
  circuit = await createCircuit(
    { name: 'Full Body', description: '', exerciseIds: [leg.id, chest.id] },
    db,
  );
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});

interface SetFixture {
  position: number;
  weight: number;
  reps: number;
  isCompleted: boolean;
}
async function seedPerformance(
  exerciseId: string,
  completedAt: string | null,
  sets: SetFixture[],
  status: WorkoutStatus = 'completed',
  circuitId = crypto.randomUUID(),
) {
  const workout: Workout = {
    ...newRecordMetadata(),
    circuitId,
    circuitName: 'Different Circuit',
    status,
    currentExercisePosition: 1,
    startedAt: '2026-10-01T09:00:00.000Z',
    completedAt,
  };
  const snapshot: WorkoutExercise = {
    ...newRecordMetadata(),
    workoutId: workout.id,
    exerciseId,
    exerciseName: 'Previous name',
    exerciseNotes: '',
    position: 1,
    weightUnit: 'lb',
  };
  await db.workouts.add(workout);
  await db.workoutExercises.add(snapshot);
  const records = sets.map((set) => ({
    ...newRecordMetadata(),
    ...set,
    workoutExerciseId: snapshot.id,
    completedAt: set.isCompleted ? completedAt : null,
  }));
  await db.workoutSets.bulkAdd(records);
  return { workout, snapshot, sets: records };
}

async function snapshotCounts() {
  return Promise.all([
    db.workouts.count(),
    db.workoutExercises.count(),
    db.workoutExerciseSettings.count(),
    db.workoutSets.count(),
  ]);
}

describe('starting workouts', () => {
  it('atomically creates the Workout, ordered exercise/setting snapshots, and no invented sets', async () => {
    const sourceSettings = (await getExerciseDetails(chest.id, db))!.settings;
    const workout = await startWorkout(circuit.id, db);
    expect(workout).toMatchObject({
      circuitId: circuit.id,
      circuitName: 'Full Body',
      status: 'in_progress',
      completedAt: null,
    });
    expect(workout.startedAt).toBe(workout.createdAt);
    const exercises = await listWorkoutExercises(workout.id, db);
    expect(
      exercises.map((row) => [
        row.exerciseId,
        row.exerciseName,
        row.exerciseNotes,
        row.position,
        row.weightUnit,
      ]),
    ).toEqual([
      [leg.id, 'Leg Press', 'Keep knees soft', 1, 'kg'],
      [chest.id, 'Chest Press', 'Neutral grip', 2, 'lb'],
    ]);
    const chestSettings = await db.workoutExerciseSettings
      .where('workoutExerciseId')
      .equals(exercises[1]!.id)
      .sortBy('position');
    expect(
      chestSettings.map((row) => [row.position, row.label, row.value, row.sourceExerciseSettingId]),
    ).toEqual(sourceSettings.map((row) => [row.position, row.label, row.value, row.id]));
    const allRecords = [workout, ...exercises, ...(await db.workoutExerciseSettings.toArray())];
    for (const row of allRecords) {
      expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(row.createdAt).toBe(workout.startedAt);
      expect(row.updatedAt).toBe(workout.startedAt);
    }
    expect(new Set(allRecords.map((row) => row.id)).size).toBe(allRecords.length);
    expect(await snapshotCounts()).toEqual([1, 2, 3, 0]);
  });

  it('rejects a deleted or empty Circuit without writing a Workout', async () => {
    const empty = await createCircuit({ name: 'Empty', description: '', exerciseIds: [] }, db);
    await expect(startWorkout(empty.id, db)).rejects.toThrow('at least one exercise');
    await expect(startWorkout(crypto.randomUUID(), db)).rejects.toThrow('no longer exists');
    expect(await snapshotCounts()).toEqual([0, 0, 0, 0]);
  });

  it('rejects missing source exercises and preferences rather than taking partial snapshots', async () => {
    await db.appSettings.clear();
    await expect(startWorkout(circuit.id, db)).rejects.toThrow('preferences');
    await initializeDatabase(db);
    await db.exercises.delete(chest.id);
    await expect(startWorkout(circuit.id, db)).rejects.toThrow('unavailable');
    expect(await snapshotCounts()).toEqual([0, 0, 0, 0]);
  });

  it('rejects a second active Workout even for a different circuit', async () => {
    const first = await startWorkout(circuit.id, db);
    const other = await createCircuit(
      { name: 'Upper Body', description: '', exerciseIds: [chest.id] },
      db,
    );
    await expect(startWorkout(other.id, db)).rejects.toBeInstanceOf(ActiveWorkoutExistsError);
    expect(await getActiveWorkout(db)).toEqual(first);
    expect(await snapshotCounts()).toEqual([1, 2, 3, 0]);
  });

  it('serializes competing starts across independent database connections', async () => {
    const secondConnection = new WtRepsDatabase(db.name);
    await secondConnection.open();
    try {
      const results = await Promise.allSettled([
        startWorkout(circuit.id, db),
        startWorkout(circuit.id, secondConnection),
      ]);
      expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
      const failed = results.find((row) => row.status === 'rejected');
      expect(failed?.status === 'rejected' && failed.reason).toBeInstanceOf(
        ActiveWorkoutExistsError,
      );
      expect(await snapshotCounts()).toEqual([1, 2, 3, 0]);
    } finally {
      secondConnection.close();
    }
  });

  it.each(['workoutExerciseSettings', 'workoutSets'] as const)(
    'rolls back all snapshot records on %s storage failure',
    async (table) => {
      if (table === 'workoutExerciseSettings')
        vi.spyOn(db.workoutExerciseSettings, 'bulkAdd').mockRejectedValueOnce(
          new Error('Storage failure'),
        );
      else vi.spyOn(db.workoutSets, 'bulkAdd').mockRejectedValueOnce(new Error('Storage failure'));
      await expect(startWorkout(circuit.id, db)).rejects.toThrow('Storage failure');
      expect(await snapshotCounts()).toEqual([0, 0, 0, 0]);
    },
  );

  it('preserves active snapshots after template renaming, notes/settings edits, reordering and unit changes', async () => {
    const workout = await startWorkout(circuit.id, db);
    const beforeExercises = await listWorkoutExercises(workout.id, db);
    const beforeSettings = await db.workoutExerciseSettings.toArray();
    await updateCircuit(
      circuit.id,
      { name: 'Renamed Circuit', description: 'Changed', exerciseIds: [chest.id, leg.id] },
      db,
    );
    await updateExercise(
      chest.id,
      {
        name: 'Renamed Chest',
        notes: 'New note',
        weightUnitOverride: 'kg',
        settings: [{ position: 1, label: 'Seat', value: '8' }],
      },
      db,
    );
    await updateExercise(
      leg.id,
      { name: 'Renamed Leg', notes: 'Changed note', weightUnitOverride: 'lb', settings: [] },
      db,
    );
    await db.appSettings.update(APP_SETTINGS_ID, { weightUnit: 'kg' });
    expect(await db.workouts.get(workout.id)).toEqual(workout);
    expect(await listWorkoutExercises(workout.id, db)).toEqual(beforeExercises);
    expect(await db.workoutExerciseSettings.toArray()).toEqual(beforeSettings);
    // Snapshots are readable without either current Exercise template.
    await deleteExercise(chest.id, db);
    await deleteExercise(leg.id, db);
    const overview = await getWorkoutOverview(workout.id, db);
    expect(overview?.exercises).toEqual(beforeExercises);
    expect(overview?.firstExerciseSettings[0]?.value).toBe('B');
  });

  it('uses the current global unit for exercises without an override', async () => {
    await db.appSettings.update(APP_SETTINGS_ID, { weightUnit: 'kg' });
    const workout = await startWorkout(circuit.id, db);
    expect((await listWorkoutExercises(workout.id, db)).map((row) => row.weightUnit)).toEqual([
      'kg',
      'kg',
    ]);
  });

  it('finds the active workout after reopening and provides Home progress from stored snapshots', async () => {
    expect(await getActiveWorkout(db)).toBeUndefined();
    const workout = await startWorkout(circuit.id, db);
    db.close();
    await db.open();
    expect(await getActiveWorkout(db)).toEqual(workout);
    expect((await getHomeData(db)).active).toEqual({
      workout,
      exerciseCount: 2,
      currentExerciseNumber: 1,
    });
  });
});

describe('previous performance', () => {
  it('copies the newest completed performance across Circuits by Exercise ID and Set order', async () => {
    await seedPerformance(chest.id, '2026-10-04T10:00:00.000Z', [
      { position: 1, weight: 95, reps: 8, isCompleted: true },
    ]);
    const latest = await seedPerformance(chest.id, '2026-10-06T10:00:00.000Z', [
      { position: 3, weight: 100, reps: 10, isCompleted: true },
      { position: 1, weight: 100, reps: 12, isCompleted: true },
      { position: 2, weight: 999, reps: 99, isCompleted: false },
    ]);
    await seedPerformance(
      chest.id,
      '2026-10-08T10:00:00.000Z',
      [{ position: 1, weight: 500, reps: 30, isCompleted: true }],
      'abandoned',
    );
    const sameName = await createExercise(
      { name: 'Chest Press', notes: '', weightUnitOverride: null },
      db,
    );
    await seedPerformance(sameName.id, '2026-10-09T10:00:00.000Z', [
      { position: 1, weight: 800, reps: 50, isCompleted: true },
    ]);
    const workout = await startWorkout(circuit.id, db);
    const snapshot = (await listWorkoutExercises(workout.id, db)).find(
      (row) => row.exerciseId === chest.id,
    )!;
    const suggestions = await db.workoutSets
      .where('workoutExerciseId')
      .equals(snapshot.id)
      .sortBy('position');
    expect(
      suggestions.map((row) => [
        row.position,
        row.weight,
        row.reps,
        row.isCompleted,
        row.completedAt,
      ]),
    ).toEqual([
      [1, 100, 12, false, null],
      [2, 100, 10, false, null],
    ]);
    expect(suggestions.every((row) => latest.sets.every((prior) => prior.id !== row.id))).toBe(
      true,
    );
    expect(suggestions.every((row) => row.createdAt === workout.startedAt)).toBe(true);
  });

  it('skips more recent completed Workouts without completed sets and uses completion time rather than start time', async () => {
    const earlier = await seedPerformance(chest.id, '2026-10-05T10:00:00.000Z', [
      { position: 1, weight: 95, reps: 12, isCompleted: true },
    ]);
    await db.workouts.update(earlier.workout.id, { startedAt: '2026-10-05T09:00:00.000Z' });
    const later = await seedPerformance(chest.id, '2026-10-06T10:00:00.000Z', [
      { position: 1, weight: 100, reps: 10, isCompleted: true },
    ]);
    await seedPerformance(chest.id, '2026-10-07T10:00:00.000Z', [
      { position: 1, weight: 500, reps: 5, isCompleted: false },
    ]);
    expect(await getPreviousCompletedSets(chest.id, db)).toEqual(later.sets);
  });

  it('ignores in-progress/abandoned Workouts and completed Workouts without a completion time', async () => {
    await seedPerformance(
      chest.id,
      null,
      [{ position: 1, weight: 500, reps: 5, isCompleted: true }],
      'in_progress',
    );
    await seedPerformance(
      chest.id,
      '2026-10-09T10:00:00.000Z',
      [{ position: 1, weight: 600, reps: 6, isCompleted: true }],
      'abandoned',
    );
    await seedPerformance(chest.id, null, [
      { position: 1, weight: 700, reps: 7, isCompleted: true },
    ]);
    expect(await getPreviousCompletedSets(chest.id, db)).toEqual([]);
  });
});

describe('abandoning workouts', () => {
  it('records abandonment and removes only incomplete Sets, preserving snapshots and completed Sets', async () => {
    const previous = await seedPerformance(chest.id, '2026-10-06T10:00:00.000Z', [
      { position: 1, weight: 100, reps: 12, isCompleted: true },
      { position: 2, weight: 100, reps: 10, isCompleted: true },
    ]);
    const workout = await startWorkout(circuit.id, db);
    const exercises = await listWorkoutExercises(workout.id, db);
    const settings = await db.workoutExerciseSettings.toArray();
    const snapshot = exercises.find((row) => row.exerciseId === chest.id)!;
    const suggestions = await db.workoutSets
      .where('workoutExerciseId')
      .equals(snapshot.id)
      .sortBy('position');
    const performed = {
      ...suggestions[0]!,
      isCompleted: true,
      completedAt: new Date().toISOString(),
    };
    await db.workoutSets.put(performed);
    const abandoned = await abandonWorkout(workout.id, db);
    expect(abandoned).toMatchObject({
      id: workout.id,
      status: 'abandoned',
      startedAt: workout.startedAt,
      createdAt: workout.createdAt,
      circuitName: 'Full Body',
    });
    expect(abandoned.completedAt).toBe(abandoned.updatedAt);
    expect(abandoned.completedAt).not.toBeNull();
    expect(await getActiveWorkout(db)).toBeUndefined();
    expect((await getHomeData(db)).active).toBeUndefined();
    expect(await db.workoutSets.get(performed.id)).toEqual(performed);
    expect(await db.workoutSets.get(suggestions[1]!.id)).toBeUndefined();
    expect(await listWorkoutExercises(workout.id, db)).toEqual(exercises);
    expect(await db.workoutExerciseSettings.toArray()).toEqual(settings);
    expect((await getWorkoutHistory(db)).map((row) => row.id)).toEqual([previous.workout.id]);
    expect(await getPreviousCompletedSets(chest.id, db)).toEqual(previous.sets);
    await startWorkout(circuit.id, db);
    expect(await db.workouts.count()).toBe(3);
  });

  it('allows abandoning a Workout without any suggested Sets', async () => {
    const workout = await startWorkout(circuit.id, db);
    await abandonWorkout(workout.id, db);
    expect(await getActiveWorkout(db)).toBeUndefined();
    expect(await db.workouts.count()).toBe(1);
    expect(await db.workoutSets.count()).toBe(0);
    await deleteCircuit(circuit.id, db);
    expect((await getWorkoutOverview(workout.id, db))?.workout.circuitName).toBe('Full Body');
  });

  it('rolls back abandoned status and Set removal if the update fails', async () => {
    await seedPerformance(chest.id, '2026-10-06T10:00:00.000Z', [
      { position: 1, weight: 100, reps: 12, isCompleted: true },
    ]);
    const workout = await startWorkout(circuit.id, db);
    const before = await db.workoutSets.toArray();
    vi.spyOn(db.workouts, 'put').mockRejectedValueOnce(new Error('Storage failure'));
    await expect(abandonWorkout(workout.id, db)).rejects.toThrow('Storage failure');
    expect(await db.workouts.get(workout.id)).toEqual(workout);
    expect(await db.workoutSets.toArray()).toEqual(before);
  });

  it('rejects unavailable/completed Workouts and leaves repeated abandonment unchanged', async () => {
    await expect(abandonWorkout(crypto.randomUUID(), db)).rejects.toThrow('no longer available');
    const completed = await seedPerformance(chest.id, '2026-10-06T10:00:00.000Z', []);
    await expect(abandonWorkout(completed.workout.id, db)).rejects.toThrow(
      'Only a workout in progress',
    );
    const workout = await startWorkout(circuit.id, db);
    const abandoned = await abandonWorkout(workout.id, db);
    expect(await abandonWorkout(workout.id, db)).toEqual(abandoned);
  });
});
