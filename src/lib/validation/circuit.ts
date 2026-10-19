import type { CircuitInput } from '../domain/circuit.js';

export class CircuitValidationError extends Error {}

export function validateCircuitInput(input: CircuitInput): CircuitInput {
  const name = input.name.trim();
  if (!name || name.length > 100) {
    throw new CircuitValidationError('Enter a circuit name between 1 and 100 characters.');
  }
  if (input.exerciseIds.some((id) => !id.trim())) {
    throw new CircuitValidationError('Choose a valid exercise.');
  }
  if (new Set(input.exerciseIds).size !== input.exerciseIds.length) {
    throw new CircuitValidationError('Each exercise can appear only once in a circuit.');
  }
  return { name, description: input.description, exerciseIds: [...input.exerciseIds] };
}
