import type { ExerciseInput, ExerciseSettingInput } from '../domain/exercise.js';
import { MAX_EXERCISE_SETTINGS } from '../domain/exerciseForm.js';

export class ExerciseValidationError extends Error {}

export function validateExerciseInput(
  input: ExerciseInput,
): ExerciseInput & { settings: ExerciseSettingInput[] } {
  const name = input.name.trim();
  if (!name || name.length > 100) {
    throw new ExerciseValidationError('Enter an exercise name between 1 and 100 characters.');
  }
  if (input.weightUnitOverride !== null && !['lb', 'kg'].includes(input.weightUnitOverride)) {
    throw new ExerciseValidationError('Choose a valid weight unit.');
  }
  if ((input.settings?.length ?? 0) > MAX_EXERCISE_SETTINGS) {
    throw new ExerciseValidationError('Use no more than five machine settings.');
  }
  const settings = (input.settings ?? [])
    .map((row) => ({ ...row, label: row.label.trim(), value: row.value.trim() }))
    .filter((row) => row.label && row.value);
  const positions = new Set<number>();
  const ids = new Set<string>();
  for (const row of settings) {
    if (row.label.length > 50 || row.value.length > 100) {
      throw new ExerciseValidationError(
        'Setting labels must be at most 50 characters and values at most 100.',
      );
    }
    if (
      !Number.isInteger(row.position) ||
      row.position < 1 ||
      row.position > MAX_EXERCISE_SETTINGS ||
      positions.has(row.position)
    ) {
      throw new ExerciseValidationError('Each setting needs a unique position between 1 and 5.');
    }
    if (row.id && ids.has(row.id))
      throw new ExerciseValidationError('Each setting must be unique.');
    positions.add(row.position);
    if (row.id) ids.add(row.id);
  }
  return { name, notes: input.notes, weightUnitOverride: input.weightUnitOverride, settings };
}
