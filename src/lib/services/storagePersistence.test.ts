import { expect, it, vi } from 'vitest';
import { getStoragePersistence, requestStoragePersistence } from './storagePersistence.js';

it('does not request again when persistence is already enabled', async () => {
  const api = { persisted: vi.fn(async () => true), persist: vi.fn(async () => true) };
  expect(await getStoragePersistence(api)).toEqual({ status: 'enabled' });
  expect(await requestStoragePersistence(api)).toEqual({ status: 'enabled' });
  expect(api.persist).not.toHaveBeenCalled();
});
it.each([true, false])(
  'handles a user request granted=%s without blocking the app',
  async (granted) => {
    const api = { persisted: vi.fn(async () => false), persist: vi.fn(async () => granted) };
    expect(await getStoragePersistence(api)).toEqual({ status: 'not_enabled' });
    expect(api.persist).not.toHaveBeenCalled();
    expect(await requestStoragePersistence(api)).toEqual({
      status: granted ? 'enabled' : 'not_enabled',
    });
    expect(api.persist).toHaveBeenCalledOnce();
  },
);
it('supports unavailable browser Storage APIs', async () => {
  expect(await getStoragePersistence()).toEqual({ status: 'unsupported' });
  expect(await requestStoragePersistence()).toEqual({ status: 'unsupported' });
});
it('treats browser API errors as nonfatal status information', async () => {
  const api = {
    persisted: async () => {
      throw new Error('Unavailable');
    },
    persist: async () => false,
  };
  expect(await getStoragePersistence(api)).toMatchObject({ unavailable: true });
  expect(await requestStoragePersistence(api)).toMatchObject({ unavailable: true });
});
