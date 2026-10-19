import { initializeDatabase } from '../data/db.js';

export async function initializeApp(): Promise<void> {
  await initializeDatabase();
}
