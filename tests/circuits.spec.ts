import { expect, test, type Page } from '@playwright/test';

async function createExercise(page: Page, name: string) {
  await page.goto('/exercises/new');
  await page.getByLabel('Exercise name').fill(name);
  await page.getByRole('group', { name: 'Setting 1', exact: true }).getByLabel('Value').fill('7');
  await page.getByRole('button', { name: 'Save Exercise' }).click();
  await expect(page).toHaveURL('/exercises');
}

test('creates, reorders, removes and persists circuit exercises offline', async ({
  page,
  context,
}) => {
  await createExercise(page, 'Leg Press');
  await createExercise(page, 'Chest Press');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.goto('/manage');
  await expect(page.getByRole('region', { name: 'Exercises' })).toContainText('2 exercises');
  await expect(page.getByRole('region', { name: 'Circuits' })).toContainText('0 circuits');
  await page.getByRole('link', { name: 'Manage Circuits' }).click();
  await expect(page.getByRole('heading', { name: 'No circuits yet' })).toBeVisible();
  await page.getByRole('link', { name: '+ New Circuit' }).click();
  await page.getByLabel('Circuit name').fill('Full Body');
  await page.getByLabel('Description').fill('Precor circuit');
  await page.getByRole('button', { name: '+ Add Exercise' }).click();
  await expect(page.getByRole('list').getByRole('button')).toHaveText([
    'Chest Press Seat 7',
    'Leg Press Seat 7',
  ]);
  await page.getByRole('button', { name: 'Chest Press Seat 7' }).click();
  await expect(page.getByLabel('Circuit name')).toHaveValue('Full Body');
  await page.getByRole('button', { name: '+ Add Exercise' }).click();
  await expect(page.getByRole('button', { name: /Chest Press/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Leg Press Seat 7' }).click();
  const order = page.getByRole('list', { name: 'Circuit exercise order' });
  await expect(order.locator('strong')).toHaveText(['1. Chest Press', '2. Leg Press']);
  await page.getByRole('button', { name: 'Move Leg Press up' }).click();
  await expect(order.locator('strong')).toHaveText(['1. Leg Press', '2. Chest Press']);
  await page.screenshot({ path: 'test-results/circuit-editor-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Save Circuit' }).click();
  await expect(page.getByText('Circuit saved', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Full Body 2 exercises', exact: true }).click();
  await expect(page).toHaveURL(/\/circuits\/[0-9a-f-]+$/);
  const editUrl = page.url();
  await expect(page.getByLabel('Description')).toHaveValue('Precor circuit');
  await expect(order.locator('strong')).toHaveText(['1. Leg Press', '2. Chest Press']);
  await page.getByRole('button', { name: 'Remove Leg Press', exact: true }).click();
  await page.getByRole('button', { name: 'Save Circuit' }).click();
  await expect(page.getByRole('link', { name: 'Full Body 1 exercise', exact: true })).toBeVisible();
  await page.goto(editUrl);
  await expect(order.locator('strong')).toHaveText(['1. Chest Press']);
  await page.goto('/manage');
  await expect(page.getByRole('region', { name: 'Exercises' })).toContainText('2 exercises');
  await expect(page.getByRole('region', { name: 'Circuits' })).toContainText('1 circuit');
});

test('creates an exercise inside an unsaved circuit without persisting a circuit draft', async ({
  page,
}) => {
  await page.goto('/circuits/new');
  await page.getByLabel('Circuit name').fill('Full Body');
  await page.getByLabel('Description').fill('Keep this description');
  await page.getByRole('button', { name: '+ Add Exercise' }).click();
  await expect(page.getByRole('heading', { name: 'No exercises yet' })).toBeVisible();
  await page.getByRole('button', { name: '+ Create New Exercise' }).click();
  await page.getByLabel('Exercise name').fill('Seated Row');
  await page.getByRole('group', { name: 'Setting 1', exact: true }).getByLabel('Value').fill('B');
  const circuitCount = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('WtReps');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const count = database.transaction('circuits').objectStore('circuits').count();
          count.onsuccess = () => {
            resolve(count.result);
            database.close();
          };
          count.onerror = () => {
            reject(count.error);
            database.close();
          };
        };
      }),
  );
  expect(circuitCount).toBe(0);
  await page.getByRole('button', { name: 'Save Exercise' }).click();
  await expect(page.getByRole('heading', { name: 'New Circuit' })).toBeVisible();
  await expect(page.getByLabel('Circuit name')).toHaveValue('Full Body');
  await expect(page.getByLabel('Description')).toHaveValue('Keep this description');
  await expect(page.getByRole('list', { name: 'Circuit exercise order' })).toContainText(
    '1. Seated Row',
  );
  await page.getByRole('button', { name: '+ Add Exercise' }).click();
  await expect(page.getByText('All exercises are already in this circuit.')).toBeVisible();
  await page.getByRole('button', { name: '‹ Back to Circuit' }).click();
  await page.getByRole('button', { name: 'Save Circuit' }).click();
  await expect(page.getByRole('link', { name: 'Full Body 1 exercise', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Full Body 1 exercise', exact: true }).click();
  await expect(page.getByLabel('Description')).toHaveValue('Keep this description');
});

test('protects both drafts and can cancel nested exercise creation without losing the circuit', async ({
  page,
}) => {
  await page.goto('/circuits/new');
  await page.getByLabel('Circuit name').fill('Keep My Circuit');
  await page.getByRole('button', { name: '+ Add Exercise' }).click();
  await page.getByRole('button', { name: '+ Create New Exercise' }).click();
  await page.getByLabel('Exercise name').fill('Unsaved Row');
  await page.getByRole('navigation').getByRole('link', { name: 'Home', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Discard changes?' });
  await expect(confirmation).toHaveCount(1);
  await confirmation.getByRole('button', { name: 'Keep Editing' }).click();
  await expect(page.getByLabel('Exercise name')).toHaveValue('Unsaved Row');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add Exercise', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No exercises yet' })).toBeVisible();
  await page.getByRole('button', { name: '‹ Back to Circuit' }).click();
  await expect(page.getByLabel('Circuit name')).toHaveValue('Keep My Circuit');
  await page.getByRole('link', { name: '‹ Circuits', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No circuits yet' })).toBeVisible();
});

test('saves an empty circuit and blocks deletion while its workout is in progress', async ({
  page,
}) => {
  await page.goto('/circuits/new');
  await page.getByLabel('Circuit name').fill('  ');
  await page.getByRole('button', { name: 'Save Circuit' }).click();
  await expect(page.getByRole('alert')).toContainText('circuit name');
  await page.getByLabel('Circuit name').fill('Lower Body');
  await page.getByRole('button', { name: 'Save Circuit' }).click();
  await page.getByRole('link', { name: /Lower Body 0 exercises/ }).click();
  await expect(page).toHaveURL(/\/circuits\/[0-9a-f-]+$/);
  const editUrl = page.url();
  await expect(page.getByText('No exercises yet.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Workout' })).toHaveCount(0);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const circuitId = location.pathname.split('/').at(-1)!;
        const request = indexedDB.open('WtReps');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('workouts', 'readwrite');
          const now = new Date().toISOString();
          transaction.objectStore('workouts').add({
            id: crypto.randomUUID(),
            circuitId,
            circuitName: 'Lower Body',
            status: 'in_progress',
            startedAt: now,
            completedAt: null,
            createdAt: now,
            updatedAt: now,
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onabort = () => {
            database.close();
            reject(transaction.error);
          };
        };
      }),
  );
  await page.getByRole('button', { name: 'Delete Circuit', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Delete Lower Body?' });
  await expect(confirmation).toContainText(
    'Historical workouts using this circuit will be preserved.',
  );
  await confirmation.getByRole('button', { name: 'Delete Circuit', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Finish or abandon the workout before deleting it.',
  );
  await expect(page.getByLabel('Circuit name')).toHaveValue('Lower Body');
  await page.goto('/circuits');
  await expect(page.getByRole('link', { name: /Lower Body 0 exercises/ })).toBeVisible();
  await page.goto(editUrl);
  await expect(page.getByLabel('Circuit name')).toHaveValue('Lower Body');
});
