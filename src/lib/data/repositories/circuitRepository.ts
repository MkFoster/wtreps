import { liveQuery } from 'dexie';
import type {
  Circuit,
  CircuitInput,
  CircuitExercise,
  CircuitSummary,
} from '../../domain/circuit.js';
import { newRecordMetadata } from '../../utils/records.js';
import { CircuitValidationError, validateCircuitInput } from '../../validation/circuit.js';
import { getDatabase, type WtRepsDatabase } from '../db.js';

export class CircuitInUseError extends Error {
  constructor() {
    super(
      'This circuit is being used by the current workout. Finish or abandon the workout before deleting it.',
    );
  }
}

export function getCircuit(id: string, db = getDatabase()) {
  return db.circuits.get(id);
}

export async function listCircuits(db = getDatabase()) {
  const circuits = await db.circuits.toArray();
  return circuits.sort(
    (a, b) =>
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id),
  );
}

export function listCircuitExercises(circuitId: string, db = getDatabase()) {
  return db.circuitExercises.where('circuitId').equals(circuitId).sortBy('position');
}

export function listCircuitSummaries(db = getDatabase()): Promise<CircuitSummary[]> {
  return db.transaction('r', [db.circuits, db.circuitExercises], async () => {
    const circuits = await listCircuits(db);
    const membership = await db.circuitExercises.toArray();
    const counts = new Map<string, number>();
    for (const row of membership) counts.set(row.circuitId, (counts.get(row.circuitId) ?? 0) + 1);
    return circuits.map((circuit) => ({ circuit, exerciseCount: counts.get(circuit.id) ?? 0 }));
  });
}

export function observeCircuits(db = getDatabase()) {
  return liveQuery(() => listCircuitSummaries(db));
}

export function getCircuitDetails(id: string, db = getDatabase()) {
  return db.transaction('r', [db.circuits, db.circuitExercises, db.exercises], async () => {
    const circuit = await db.circuits.get(id);
    if (!circuit) return undefined;
    const membership = await listCircuitExercises(id, db);
    const exercises = await db.exercises.bulkGet(membership.map((row) => row.exerciseId));
    if (exercises.some((exercise) => !exercise))
      throw new Error('A circuit exercise is unavailable. Reopen the circuit and try again.');
    return {
      circuit,
      membership,
      exercises: exercises.filter((exercise) => exercise !== undefined),
    };
  });
}

export async function createCircuit(input: CircuitInput, db = getDatabase()): Promise<Circuit> {
  const { exerciseIds, ...values } = validateCircuitInput(input);
  const circuit = { ...newRecordMetadata(), ...values };
  await db.transaction('rw', [db.circuits, db.circuitExercises, db.exercises], async () => {
    await db.circuits.add(circuit);
    await replaceMembership(circuit.id, exerciseIds, db);
  });
  return circuit;
}

export async function updateCircuit(
  id: string,
  input: CircuitInput,
  db = getDatabase(),
): Promise<void> {
  const { exerciseIds, ...values } = validateCircuitInput(input);
  await db.transaction('rw', [db.circuits, db.circuitExercises, db.exercises], async () => {
    if (!(await db.circuits.get(id)))
      throw new CircuitValidationError('This circuit no longer exists.');
    await db.circuits.update(id, { ...values, updatedAt: new Date().toISOString() });
    await replaceMembership(id, exerciseIds, db);
  });
}

async function replaceMembership(circuitId: string, exerciseIds: string[], db: WtRepsDatabase) {
  const exercises = await db.exercises.bulkGet(exerciseIds);
  if (exercises.some((exercise) => !exercise)) {
    throw new CircuitValidationError(
      'An exercise was deleted. Remove it from this circuit before saving.',
    );
  }
  const existing = await db.circuitExercises.where('circuitId').equals(circuitId).toArray();
  const records: CircuitExercise[] = exerciseIds.map((exerciseId, index) => ({
    ...newRecordMetadata(),
    ...existing.find((row) => row.exerciseId === exerciseId),
    circuitId,
    exerciseId,
    position: index + 1,
    updatedAt: new Date().toISOString(),
  }));
  // Clear old positions first so swapping two unique positions is atomic and safe.
  await db.circuitExercises.where('circuitId').equals(circuitId).delete();
  await db.circuitExercises.bulkAdd(records);
}

export async function deleteCircuit(id: string, db = getDatabase()): Promise<void> {
  await db.transaction('rw', [db.circuits, db.circuitExercises, db.workouts], async () => {
    const active = await db.workouts
      .where('circuitId')
      .equals(id)
      .filter((workout) => workout.status === 'in_progress')
      .first();
    if (active) throw new CircuitInUseError();
    await db.circuitExercises.where('circuitId').equals(id).delete();
    await db.circuits.delete(id);
  });
}
