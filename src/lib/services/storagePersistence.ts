export interface StorageApi {
  persisted(): Promise<boolean>;
  persist(): Promise<boolean>;
}
export interface StorageState {
  status: 'enabled' | 'not_enabled' | 'unsupported';
  unavailable?: boolean;
}
function browserStorage(): StorageApi | undefined {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage?.persisted ||
    !navigator.storage?.persist
  )
    return undefined;
  return navigator.storage;
}
export async function getStoragePersistence(api = browserStorage()): Promise<StorageState> {
  if (!api) return { status: 'unsupported' };
  try {
    return { status: (await api.persisted()) ? 'enabled' : 'not_enabled' };
  } catch {
    return { status: 'not_enabled', unavailable: true };
  }
}
export async function requestStoragePersistence(api = browserStorage()): Promise<StorageState> {
  if (!api) return { status: 'unsupported' };
  try {
    return { status: (await api.persisted()) || (await api.persist()) ? 'enabled' : 'not_enabled' };
  } catch {
    return { status: 'not_enabled', unavailable: true };
  }
}
