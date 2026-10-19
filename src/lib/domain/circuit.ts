import type { RecordMetadata } from './common.js';

export interface Circuit extends RecordMetadata {
  name: string;
  description: string;
}

export interface CircuitExercise extends RecordMetadata {
  circuitId: string;
  exerciseId: string;
  position: number;
}

// Array order is the draft order. Persistent positions are derived as index + 1.
export interface CircuitInput {
  name: string;
  description: string;
  exerciseIds: string[];
}

export interface CircuitSummary {
  circuit: Circuit;
  exerciseCount: number;
}
