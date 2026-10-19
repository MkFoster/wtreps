import { expect, test } from '@playwright/test';

test('initializes real IndexedDB and launches unvisited routes offline', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your workout', exact: true })).toBeVisible();

  const manifest = await (await context.request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('WtReps');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toHaveLength(3);
  for (const icon of manifest.icons) {
    const response = await context.request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active?.state !== 'activated') {
      await new Promise<void>((resolve) => {
        registration.active?.addEventListener('statechange', () => {
          if (registration.active?.state === 'activated') resolve();
        });
      });
    }
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const settings = await page.evaluate(
    () =>
      new Promise<{ weightUnit: string; id: string }>((resolve, reject) => {
        const request = indexedDB.open('WtReps');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const read = database
            .transaction('appSettings')
            .objectStore('appSettings')
            .get('app-settings');
          read.onsuccess = () => {
            resolve(read.result);
            database.close();
          };
          read.onerror = () => {
            reject(read.error);
            database.close();
          };
        };
      }),
  );
  expect(settings).toMatchObject({ id: 'app-settings', weightUnit: 'lb' });

  await context.setOffline(true);
  // No feature route was visited online; the entire application shell must be cached.
  for (const label of ['History', 'Manage', 'Settings', 'Home']) {
    await page.getByRole('navigation').getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      label === 'Home' ? 'Your workout' : label,
    );
  }
  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();

  const reopened = await context.newPage();
  await reopened.goto('/settings');
  await expect(reopened.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await reopened.close();
  expect(errors).toEqual([]);
});
