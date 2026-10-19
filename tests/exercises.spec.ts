import { expect, test, type Page } from '@playwright/test';

async function createChestPress(page: Page) {
  await page.goto('/manage');
  await page.getByRole('link', { name: 'Manage Exercises' }).click();
  await expect(page.getByRole('heading', { name: 'No exercises yet' })).toBeVisible();
  await page.getByRole('link', { name: '+ New Exercise' }).click();
  await expect(
    page.getByRole('group', { name: 'Setting 1', exact: true }).getByLabel('Label'),
  ).toHaveValue('Seat');
  await expect(
    page.getByRole('group', { name: 'Setting 1', exact: true }).getByLabel('Value'),
  ).toHaveValue('');
  await page.getByLabel('Exercise name').fill('Chest Press');
  await page.getByRole('group', { name: 'Setting 1', exact: true }).getByLabel('Value').fill('7');
  await page.getByRole('button', { name: '+ Setting', exact: true }).click();
  const handle = page.getByRole('group', { name: 'Setting 2', exact: true });
  await handle.getByLabel('Label').fill('Handle Position');
  await handle.getByLabel('Value').fill('3');
  await page.getByLabel('Notes').fill('Keep elbows below shoulders.');
  await page.getByRole('button', { name: 'Save Exercise' }).click();
  await expect(page).toHaveURL('/exercises');
  await expect(page.getByText('Exercise saved', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Chest Press Seat 7 · Handle Position 3' }),
  ).toBeVisible();
  await expect(page.getByText('Keep elbows below shoulders.')).toHaveCount(0);
}

test('creates and edits machine settings offline and persists after reopening', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await createChestPress(page);
  await page.getByRole('link', { name: /Chest Press Seat 7/ }).click();
  await expect(page).toHaveURL(/\/exercises\/[0-9a-f-]+$/);
  const editUrl = page.url();
  await expect(page.getByLabel('Notes')).toHaveValue('Keep elbows below shoulders.');
  await page.getByRole('group', { name: 'Setting 1', exact: true }).getByLabel('Value').fill('8');
  await page.getByLabel('Weight unit').selectOption('kg');
  // Add a temporary incomplete row; it must disappear on saving.
  await page.getByRole('button', { name: '+ Setting', exact: true }).click();
  await page
    .getByRole('group', { name: 'Setting 3', exact: true })
    .getByLabel('Label')
    .fill('Incomplete');
  await page.screenshot({ path: 'test-results/exercise-editor-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Save Exercise' }).click();
  await expect(
    page.getByRole('link', { name: 'Chest Press Seat 8 · Handle Position 3' }),
  ).toBeVisible();
  await page.goto(editUrl);
  await expect(
    page.getByRole('group', { name: 'Setting 1', exact: true }).getByLabel('Value'),
  ).toHaveValue('8');
  await expect(page.getByLabel('Weight unit')).toHaveValue('kg');
  await expect(page.getByRole('group', { name: 'Setting 3', exact: true })).toHaveCount(0);
});

test('validates the name, limits rows, and protects unsaved changes', async ({ page }) => {
  await page.goto('/exercises/new');
  // A first visit directly to an editor must register the root-scoped worker.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.getByLabel('Exercise name').fill('   ');
  await page.getByRole('button', { name: 'Save Exercise' }).click();
  await expect(page.getByRole('alert')).toContainText('exercise name');
  await page.getByLabel('Exercise name').fill('Unsaved Press');
  for (let count = 1; count < 5; count++)
    await page.getByRole('button', { name: '+ Setting', exact: true }).click();
  await expect(page.getByRole('button', { name: '+ Setting', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove setting 3' }).click();
  await expect(page.getByRole('button', { name: '+ Setting', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '‹ Exercises', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Discard changes?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep Editing' }).click();
  await expect(page.getByLabel('Exercise name')).toHaveValue('Unsaved Press');
  await page.getByRole('link', { name: '‹ Exercises', exact: true }).click();
  await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page).toHaveURL('/exercises');
  await expect(page.getByRole('heading', { name: 'No exercises yet' })).toBeVisible();
});

test('confirms deletion with affected Circuit names and handles a deleted deep link', async ({
  page,
}) => {
  await createChestPress(page);
  await page.getByRole('link', { name: /Chest Press Seat 7/ }).click();
  await expect(page).toHaveURL(/\/exercises\/[0-9a-f-]+$/);
  const editUrl = page.url();
  // Seed Circuit membership through real IndexedDB; Circuit UI is outside this slice.
  await page.evaluate(async () => {
    const exerciseId = location.pathname.split('/').at(-1)!;
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('WtReps');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(['circuits', 'circuitExercises'], 'readwrite');
        for (const name of ['Full Body', 'Upper Body']) {
          const id = crypto.randomUUID();
          const now = new Date().toISOString();
          transaction
            .objectStore('circuits')
            .add({ id, name, description: '', createdAt: now, updatedAt: now });
          transaction.objectStore('circuitExercises').add({
            id: crypto.randomUUID(),
            circuitId: id,
            exerciseId,
            position: 1,
            createdAt: now,
            updatedAt: now,
          });
        }
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  });
  await page.getByRole('button', { name: 'Delete Exercise', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Delete Chest Press?' });
  await expect(confirmation.getByText('Full Body', { exact: true })).toBeVisible();
  await expect(confirmation.getByText('Upper Body', { exact: true })).toBeVisible();
  await expect(confirmation).toContainText('Historical workouts will not be changed.');
  await confirmation.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Exercise name')).toHaveValue('Chest Press');
  await page.getByRole('button', { name: 'Delete Exercise', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Delete Exercise', exact: true }).click();
  await expect(page).toHaveURL('/exercises');
  await expect(page.getByText('Exercise deleted', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No exercises yet' })).toBeVisible();
  await page.goto(editUrl);
  await expect(page.getByText('This exercise is no longer available.')).toBeVisible();
});
