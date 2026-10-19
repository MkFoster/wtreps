import { APP_SETTINGS_ID, type AppSettings } from '../../domain/settings.js';
import { getDatabase, initializeDatabase } from '../db.js';
import { liveQuery } from 'dexie';
import type { WeightUnit } from '../../domain/common.js';

export async function getSettings(db = getDatabase()): Promise<AppSettings> {
  await initializeDatabase(db);
  const settings = await db.appSettings.get(APP_SETTINGS_ID);
  if (!settings) throw new Error('Application settings could not be loaded.');
  return settings;
}

export function observeSettings(db = getDatabase()) {
  return liveQuery(async () => {
    const settings = await db.appSettings.get(APP_SETTINGS_ID);
    if (!settings) throw new Error('Application settings could not be loaded.');
    return settings;
  });
}
export function updateWeightUnit(weightUnit: WeightUnit, db = getDatabase()) {
  if (weightUnit !== 'lb' && weightUnit !== 'kg') throw new Error('Invalid weight unit.');
  return db.transaction('rw', db.appSettings, async () => {
    if (
      !(await db.appSettings.update(APP_SETTINGS_ID, {
        weightUnit,
        updatedAt: new Date().toISOString(),
      }))
    )
      throw new Error('Application settings could not be loaded.');
  });
}
