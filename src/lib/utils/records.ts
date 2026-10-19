import type { RecordMetadata } from '../domain/common.js';

export function newRecordMetadata(): RecordMetadata {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}
