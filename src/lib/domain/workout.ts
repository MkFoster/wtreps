import type { RecordMetadata, WeightUnit } from './common.js';

export type WorkoutStatus = 'in_progress' | 'completed' | 'abandoned';

export interface Workout extends RecordMetadata {
  circuitId: string;
  circuitName: string;
  status: WorkoutStatus;
  currentExercisePosition: number;
  startedAt: string;
  completedAt: string | null;
}

export interface WorkoutExercise extends RecordMetadata {
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  exerciseNotes: string;
  position: number;
  weightUnit: WeightUnit;
}

export interface WorkoutExerciseSetting extends RecordMetadata {
  workoutExerciseId: string;
  sourceExerciseSettingId: string;
  position: number;
  label: string;
  value: string;
}

export interface WorkoutSet extends RecordMetadata {
  workoutExerciseId: string;
  position: number;
  weight: number | null;
  reps: number | null;
  isCompleted: boolean;
  completedAt: string | null;
}

// Read models do not duplicate persisted domain state.
export interface WorkoutOverview {
  workout: Workout;
  exercises: WorkoutExercise[];
  firstExerciseSettings: WorkoutExerciseSetting[];
}

export function resolveExercisePosition(
  position: number | undefined,
  exercises: WorkoutExercise[],
) {
  const positions = exercises.map((row) => row.position).sort((a, b) => a - b);
  if (!positions.length) return 1;
  if (!Number.isInteger(position)) return positions[0]!;
  return positions.reduce((best, value) =>
    Math.abs(value - position!) < Math.abs(best - position!) ? value : best,
  );
}

export class WorkoutActionError extends Error {}

export class ActiveWorkoutExistsError extends WorkoutActionError {
  constructor(readonly workoutId: string) {
    super('A workout is already in progress. Resume or abandon it before starting another.');
  }
}
