import type { RecordMetadata, WeightUnit } from './common.js';

export interface Exercise extends RecordMetadata {
  name: string;
  notes: string;
  weightUnitOverride: WeightUnit | null;
}

export interface ExerciseSetting extends RecordMetadata {
  exerciseId: string;
  position: number;
  label: string;
  value: string;
}

export interface ExerciseSettingInput {
  id?: string;
  position: number;
  label: string;
  value: string;
}

export interface ExerciseInput {
  name: string;
  notes: string;
  weightUnitOverride: WeightUnit | null;
  settings?: ExerciseSettingInput[];
}

export interface ExerciseDetails {
  exercise: Exercise;
  settings: ExerciseSetting[];
}
