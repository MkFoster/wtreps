import type { HistoricalWorkout } from '../data/repositories/historyRepository.js';

export interface HistoricalSetDraft {
  key: string;
  id?: string;
  weight: string;
  reps: string;
}
export interface HistoricalExerciseDraft {
  id: string;
  sets: HistoricalSetDraft[];
  settings: { id: string; value: string }[];
}
export interface HistoricalWorkoutDraft {
  updatedAt: string;
  exercises: HistoricalExerciseDraft[];
}
export function createHistoryDraft(detail: HistoricalWorkout): HistoricalWorkoutDraft {
  return {
    updatedAt: detail.workout.updatedAt,
    exercises: detail.exercises.map(({ exercise, sets, settings }) => ({
      id: exercise.id,
      sets: sets.map((row) => ({
        key: row.id,
        id: row.id,
        weight: row.weight?.toString() ?? '',
        reps: row.reps?.toString() ?? '',
      })),
      settings: settings.map((row) => ({ id: row.id, value: row.value })),
    })),
  };
}
export function newHistoricalSet(sets: HistoricalSetDraft[]): HistoricalSetDraft {
  const last = sets.at(-1);
  return { key: crypto.randomUUID(), weight: last?.weight ?? '', reps: last?.reps ?? '' };
}
