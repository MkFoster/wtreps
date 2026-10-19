import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WtRepsDatabase, initializeDatabase } from '../db.js';
import {
  createCircuit,
  deleteCircuit,
  getCircuitDetails,
  listCircuits,
  listCircuitExercises,
  listCircuitSummaries,
  updateCircuit,
  CircuitInUseError,
} from './circuitRepository.js';
import { createExercise, deleteExercise } from './exerciseRepository.js';
import { addCircuitExercise, moveCircuitExercise } from '../../domain/circuitForm.js';
import { newRecordMetadata } from '../../utils/records.js';
import type { Exercise } from '../../domain/exercise.js';
import type { WorkoutStatus } from '../../domain/workout.js';

let db: WtRepsDatabase;
let exercises: Exercise[];
const draft = (exerciseIds: string[] = [], name = 'Full Body') => ({
  name,
  description: '',
  exerciseIds,
});
beforeEach(async () => {
  db = new WtRepsDatabase(`WtReps-circuits-${crypto.randomUUID()}`);
  await initializeDatabase(db);
  exercises = [];
  for (const name of ['Chest Press', 'Leg Press', 'Row']) {
    exercises.push(await createExercise({ name, notes: '', weightUnitOverride: null }, db));
  }
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});

async function seedWorkout(circuitId: string, status: WorkoutStatus) {
  const workout = {
    ...newRecordMetadata(),
    circuitId,
    circuitName: 'Original Full Body',
    status,
    currentExercisePosition: 1,
    startedAt: new Date().toISOString(),
    completedAt: status === 'in_progress' ? null : new Date().toISOString(),
  };
  await db.workouts.add(workout);
  return workout;
}

describe('Circuit Management', () => {
  it('creates a valid zero-exercise circuit and lists accurate zero counts', async () => {
    const circuit = await createCircuit(draft([], ' Full Body '), db);
    expect(circuit.name).toBe('Full Body');
    expect(circuit.description).toBe('');
    expect(circuit.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await listCircuitExercises(circuit.id, db)).toEqual([]);
    expect(await listCircuitSummaries(db)).toEqual([{ circuit, exerciseCount: 0 }]);
  });

  it('lists circuits alphabetically regardless of case with actual membership counts', async () => {
    await createCircuit(draft([exercises[0]!.id], 'Upper Body'), db);
    await createCircuit(draft([], 'lower Body'), db);
    await createCircuit(draft(exercises.map((row) => row.id)), db);
    expect((await listCircuits(db)).map((row) => row.name)).toEqual([
      'Full Body',
      'lower Body',
      'Upper Body',
    ]);
    expect((await listCircuitSummaries(db)).map((row) => row.exerciseCount)).toEqual([3, 0, 1]);
  });

  it('creates ordered memberships and resolves names in circuit order', async () => {
    const ids = [exercises[2]!.id, exercises[0]!.id, exercises[1]!.id];
    const circuit = await createCircuit(draft(ids), db);
    const membership = await listCircuitExercises(circuit.id, db);
    expect(membership.map((row) => [row.exerciseId, row.position])).toEqual(
      ids.map((id, index) => [id, index + 1]),
    );
    expect((await getCircuitDetails(circuit.id, db))?.exercises.map((row) => row.name)).toEqual([
      'Row',
      'Chest Press',
      'Leg Press',
    ]);
  });

  it('adds exercises to the end of a draft and prevents duplicates', async () => {
    let rows = addCircuitExercise([], exercises[0]!);
    rows = addCircuitExercise(rows, exercises[1]!);
    rows = addCircuitExercise(rows, exercises[0]!);
    expect(rows.map((row) => row.name)).toEqual(['Chest Press', 'Leg Press']);
    await expect(createCircuit(draft([exercises[0]!.id, exercises[0]!.id]), db)).rejects.toThrow(
      'only once',
    );
    expect(await db.circuits.count()).toBe(0);
  });

  it('moves exercises immediately in local form order without mutating the original array', () => {
    const moved = moveCircuitExercise(exercises, 2, -1);
    expect(moved.map((row) => row.name)).toEqual(['Chest Press', 'Row', 'Leg Press']);
    expect(exercises.map((row) => row.name)).toEqual(['Chest Press', 'Leg Press', 'Row']);
    expect(moveCircuitExercise(moved, 0, -1)).toBe(moved);
    expect(moveCircuitExercise(moved, 2, 1)).toBe(moved);
  });

  it('renames, adds, removes and reorders transactionally with normalized positions and stable membership IDs', async () => {
    const circuit = await createCircuit(draft(exercises.slice(0, 2).map((row) => row.id)), db);
    const before = await listCircuitExercises(circuit.id, db);
    await updateCircuit(
      circuit.id,
      {
        ...draft([exercises[2]!.id, exercises[1]!.id]),
        name: ' Full Body A ',
        description: 'Precor machines',
      },
      db,
    );
    const details = (await getCircuitDetails(circuit.id, db))!;
    expect(details.circuit).toMatchObject({
      name: 'Full Body A',
      description: 'Precor machines',
      createdAt: circuit.createdAt,
    });
    expect(details.membership.map((row) => row.position)).toEqual([1, 2]);
    expect(details.exercises.map((row) => row.name)).toEqual(['Row', 'Leg Press']);
    expect(details.membership[1]?.id).toBe(before[1]!.id);
    expect(await db.exercises.count()).toBe(3);
    await updateCircuit(circuit.id, draft(exercises.map((row) => row.id).reverse()), db);
    expect((await listCircuitExercises(circuit.id, db)).map((row) => row.position)).toEqual([
      1, 2, 3,
    ]);
    await updateCircuit(circuit.id, draft([]), db);
    expect(await listCircuitExercises(circuit.id, db)).toEqual([]);
    expect(await db.exercises.count()).toBe(3);
  });

  it('rejects duplicate membership on update without modifying existing data', async () => {
    const circuit = await createCircuit(draft([exercises[0]!.id]), db);
    const before = await getCircuitDetails(circuit.id, db);
    await expect(
      updateCircuit(circuit.id, draft([exercises[1]!.id, exercises[1]!.id], 'Changed'), db),
    ).rejects.toThrow('only once');
    expect(await getCircuitDetails(circuit.id, db)).toEqual(before);
  });

  it('rejects empty names and stale exercise IDs before committing', async () => {
    for (const name of ['', '  ', 'x'.repeat(101)])
      await expect(createCircuit(draft([], name), db)).rejects.toThrow('name');
    await expect(createCircuit(draft([crypto.randomUUID()]), db)).rejects.toThrow('deleted');
    expect(await db.circuits.count()).toBe(0);
    expect(await db.circuitExercises.count()).toBe(0);
  });

  it('rolls back circuit updates if a selected exercise was deleted in another tab', async () => {
    const circuit = await createCircuit(draft([exercises[0]!.id]), db);
    await deleteExercise(exercises[1]!.id, db);
    const before = await getCircuitDetails(circuit.id, db);
    await expect(
      updateCircuit(circuit.id, draft([exercises[1]!.id], 'Changed'), db),
    ).rejects.toThrow('deleted');
    expect(await getCircuitDetails(circuit.id, db)).toEqual(before);
  });

  it('rolls back circuit creation and membership when storage fails', async () => {
    vi.spyOn(db.circuitExercises, 'bulkAdd').mockRejectedValueOnce(new Error('Storage failure'));
    await expect(createCircuit(draft([exercises[0]!.id]), db)).rejects.toThrow('Storage failure');
    expect(await db.circuits.count()).toBe(0);
    expect(await db.circuitExercises.count()).toBe(0);
  });

  it('rolls back replacement membership and circuit details when storage fails', async () => {
    const circuit = await createCircuit(draft([exercises[0]!.id]), db);
    const before = await getCircuitDetails(circuit.id, db);
    vi.spyOn(db.circuitExercises, 'bulkAdd').mockRejectedValueOnce(new Error('Storage failure'));
    await expect(
      updateCircuit(circuit.id, draft([exercises[1]!.id], 'Changed'), db),
    ).rejects.toThrow('Storage failure');
    expect(await getCircuitDetails(circuit.id, db)).toEqual(before);
  });

  it('preserves all historical records when editing and deleting the source circuit', async () => {
    const circuit = await createCircuit(draft([exercises[0]!.id]), db);
    const other = await createCircuit(draft([exercises[1]!.id], 'Other Circuit'), db);
    const workout = await seedWorkout(circuit.id, 'completed');
    const snapshot = {
      ...newRecordMetadata(),
      workoutId: workout.id,
      exerciseId: exercises[0]!.id,
      exerciseName: 'Original Chest Press',
      exerciseNotes: '',
      position: 1,
      weightUnit: 'lb' as const,
    };
    const setting = {
      ...newRecordMetadata(),
      workoutExerciseId: snapshot.id,
      sourceExerciseSettingId: crypto.randomUUID(),
      position: 1,
      label: 'Seat',
      value: '7',
    };
    const set = {
      ...newRecordMetadata(),
      workoutExerciseId: snapshot.id,
      position: 1,
      weight: 100,
      reps: 12,
      isCompleted: true,
      completedAt: new Date().toISOString(),
    };
    await db.workoutExercises.add(snapshot);
    await db.workoutExerciseSettings.add(setting);
    await db.workoutSets.add(set);
    await updateCircuit(circuit.id, draft([exercises[2]!.id], 'Renamed Circuit'), db);
    expect(await db.workouts.get(workout.id)).toEqual(workout);
    await deleteCircuit(circuit.id, db);
    expect(await getCircuitDetails(circuit.id, db)).toBeUndefined();
    expect(await listCircuitExercises(circuit.id, db)).toEqual([]);
    expect(await listCircuitExercises(other.id, db)).toHaveLength(1);
    expect(await db.exercises.count()).toBe(3);
    expect(await db.workouts.get(workout.id)).toEqual(workout);
    expect(await db.workoutExercises.get(snapshot.id)).toEqual(snapshot);
    expect(await db.workoutExerciseSettings.get(setting.id)).toEqual(setting);
    expect(await db.workoutSets.get(set.id)).toEqual(set);
  });

  it('blocks deletion atomically while this circuit has an in-progress workout', async () => {
    const circuit = await createCircuit(draft([exercises[0]!.id]), db);
    await seedWorkout(circuit.id, 'in_progress');
    const before = await getCircuitDetails(circuit.id, db);
    await expect(deleteCircuit(circuit.id, db)).rejects.toBeInstanceOf(CircuitInUseError);
    expect(await getCircuitDetails(circuit.id, db)).toEqual(before);
    expect(await db.workouts.count()).toBe(1);
  });

  it.each(['completed', 'abandoned'] as const)(
    'allows deletion when a related workout is %s',
    async (status) => {
      const circuit = await createCircuit(draft(), db);
      const workout = await seedWorkout(circuit.id, status);
      await seedWorkout(crypto.randomUUID(), 'in_progress');
      await deleteCircuit(circuit.id, db);
      expect(await getCircuitDetails(circuit.id, db)).toBeUndefined();
      expect(await db.workouts.get(workout.id)).toEqual(workout);
    },
  );

  it('rolls back related membership deletion if deleting the circuit fails', async () => {
    const circuit = await createCircuit(draft(exercises.map((row) => row.id)), db);
    const before = await getCircuitDetails(circuit.id, db);
    vi.spyOn(db.circuits, 'delete').mockRejectedValueOnce(new Error('Storage failure'));
    await expect(deleteCircuit(circuit.id, db)).rejects.toThrow('Storage failure');
    expect(await getCircuitDetails(circuit.id, db)).toEqual(before);
  });
});
