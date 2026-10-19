import type { Exercise } from './exercise.js';

export function addCircuitExercise(exercises: Exercise[], exercise: Exercise): Exercise[] {
  return exercises.some((row) => row.id === exercise.id) ? exercises : [...exercises, exercise];
}

export function moveCircuitExercise(
  exercises: Exercise[],
  index: number,
  direction: -1 | 1,
): Exercise[] {
  const target = index + direction;
  if (index < 0 || index >= exercises.length || target < 0 || target >= exercises.length)
    return exercises;
  const result = [...exercises];
  [result[index], result[target]] = [result[target]!, result[index]!];
  return result;
}
