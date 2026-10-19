import { liveQuery } from 'dexie';
import { getDatabase } from '../db.js';

export function observeManageCounts(db = getDatabase()) {
  return liveQuery(() =>
    db.transaction('r', [db.exercises, db.circuits], async () => ({
      exercises: await db.exercises.count(),
      circuits: await db.circuits.count(),
    })),
  );
}
