import type { ExerciseInput, ExerciseSettingInput } from './exercise.js';

export const MAX_EXERCISE_SETTINGS = 5;

export function newExerciseForm(): ExerciseInput & { settings: ExerciseSettingInput[] } {
  return {
    name: '',
    notes: '',
    weightUnitOverride: null,
    settings: [{ position: 1, label: 'Seat', value: '' }],
  };
}

export function summarizeSettings(
  settings: Pick<ExerciseSettingInput, 'label' | 'value'>[],
): string {
  const summary = settings.slice(0, 2).map((setting) => `${setting.label} ${setting.value}`);
  if (settings.length > 2) summary.push(`+${settings.length - 2} more`);
  return summary.join(' · ');
}
