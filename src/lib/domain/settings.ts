import type { RecordMetadata, WeightUnit } from './common.js';

export const APP_SETTINGS_ID = 'app-settings' as const;

export interface AppSettings extends RecordMetadata {
  id: typeof APP_SETTINGS_ID;
  weightUnit: WeightUnit;
  restTimerEnabled: boolean;
  defaultRestSeconds: number;
  lastExportAt: string | null;
}

export function createDefaultSettings(now = new Date().toISOString()): AppSettings {
  return {
    id: APP_SETTINGS_ID,
    weightUnit: 'lb',
    restTimerEnabled: false,
    defaultRestSeconds: 90,
    lastExportAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
