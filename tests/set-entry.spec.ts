import { expect, test, type Page } from '@playwright/test';

async function prepare(page: Page) {
  for (const name of ['Chest Press', 'Leg Press']) {
    await page.goto('/exercises/new');
    await page.getByLabel('Exercise name').fill(name);
    await page.getByRole('group', { name: 'Setting 1', exact: true }).getByLabel('Value').fill('7');
    await page.getByLabel('Notes').fill('Neutral grip');
    await page.getByRole('button', { name: 'Save Exercise' }).click();
    await expect(page).toHaveURL('/exercises');
  }
  await page.goto('/circuits/new');
  await page.getByLabel('Circuit name').fill('Full Body');
  for (const name of ['Chest Press', 'Leg Press']) {
    await page.getByRole('button', { name: '+ Add Exercise' }).click();
    await page.getByRole('button', { name: `${name} Seat 7` }).click();
  }
  await page.getByRole('button', { name: 'Save Circuit' }).click();
  await expect(page).toHaveURL('/circuits');
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Workout' }).click();
  await expect(page.getByRole('heading', { name: 'Chest Press' })).toBeVisible();
}
async function record(page: Page, number: number, weight: string, reps: string) {
  const card = page.getByRole('region', { name: `Set ${number}`, exact: true });
  await card.getByRole('textbox', { name: 'Weight' }).fill(weight);
  await card.getByRole('textbox', { name: 'Reps' }).fill(reps);
  await card.getByRole('button', { name: '✓ Complete Set' }).click();
  await expect(card.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
}
async function finish(page: Page) {
  await page.getByRole('button', { name: 'End Workout', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'End Workout?' })
    .getByRole('button', { name: 'End Workout', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Workout Complete', exact: true })).toBeVisible();
}

test('records Sets, edits, deletes, resumes exact Exercise and completes offline', async ({
  page,
  context,
}) => {
  await prepare(page);
  const workoutUrl = page.url();
  await expect(page.getByRole('region', { name: 'Machine Settings' })).toContainText('Seat 7');
  await expect(page.getByText('Neutral grip')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Last Time' })).toContainText('No previous sets');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await expect(page.getByRole('region', { name: 'Set 1', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '✓ Complete Set' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter weight and reps');
  await record(page, 1, '102.5', '12');
  await page.getByRole('button', { name: '+ Set', exact: true }).click();
  const second = page.getByRole('region', { name: 'Set 2', exact: true });
  await expect(second.getByRole('textbox', { name: 'Weight' })).toHaveValue('102.5');
  await expect(second.getByRole('textbox', { name: 'Reps' })).toHaveValue('12');
  await record(page, 2, '100', '10');
  const first = page.getByRole('region', { name: 'Set 1', exact: true });
  await first.getByRole('button', { name: 'Edit', exact: true }).click();
  await first.getByRole('textbox', { name: 'Reps' }).fill('11');
  await first.getByRole('button', { name: 'Done Editing' }).click();
  await expect(first).toContainText('102.5 lb × 11 reps');
  await page.getByRole('button', { name: '+ Set', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Set 3', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Set 3', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next ›' }).click();
  await expect(page.getByRole('heading', { name: 'Leg Press' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Weight' }).fill('75');
  await page.getByRole('textbox', { name: 'Reps' }).fill('8');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve, reject) => {
            const request = indexedDB.open('WtReps');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const database = request.result;
              const query = database.transaction('workoutSets').objectStore('workoutSets').getAll();
              query.onsuccess = () => {
                resolve(query.result.some((row) => row.weight === 75 && row.reps === 8));
                database.close();
              };
              query.onerror = () => {
                reject(query.error);
                database.close();
              };
            };
          }),
      ),
    )
    .toBe(true);
  // Input events alone persisted the final values, without blur, Save, or navigation.
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Weight' })).toHaveValue('75');
  await expect(page.getByRole('textbox', { name: 'Reps' })).toHaveValue('8');
  // Home navigation flushes input writes, even without completing this Set.
  await page.getByRole('link', { name: /Home/ }).click();
  await expect(
    page.getByRole('region', { name: 'Workout in Progress', exact: true }),
  ).toContainText('Exercise 2 of 2');
  await page.getByRole('link', { name: 'Resume Workout' }).click();
  await expect(page.getByRole('heading', { name: 'Leg Press' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Leg Press' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Weight' })).toHaveValue('75');
  await expect(page.getByRole('textbox', { name: 'Reps' })).toHaveValue('8');
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(workoutUrl);
  await expect(reopened.getByRole('heading', { name: 'Leg Press' })).toBeVisible();
  await expect(reopened.getByRole('button', { name: 'Finish', exact: true })).toBeVisible();
  await reopened.getByRole('button', { name: '‹ Previous' }).click();
  await expect(reopened.getByRole('heading', { name: 'Chest Press' })).toBeVisible();
  await expect(reopened.getByRole('region', { name: 'Set 1', exact: true })).toContainText(
    '102.5 lb × 11 reps',
  );
  await expect(reopened.getByRole('region', { name: 'Set 2', exact: true })).toContainText(
    '100 lb × 10 reps',
  );
  await reopened.screenshot({ path: 'test-results/set-entry-mobile.png', fullPage: true });
  await reopened.getByRole('button', { name: '+ Set', exact: true }).click();
  await reopened
    .getByRole('region', { name: 'Set 3', exact: true })
    .getByRole('textbox', { name: 'Reps' })
    .fill('1.5');
  // Invalid unfinished input must not prevent discarding incomplete Sets at End.
  await reopened.getByRole('button', { name: 'End Workout', exact: true }).click();
  await reopened.getByRole('dialog').getByRole('button', { name: 'Keep Working' }).click();
  await finish(reopened);
  await expect(reopened).toHaveURL(/\/summary$/);
  await expect(reopened.locator('dl')).toContainText('Exercises completed 1');
  await expect(reopened.locator('dl')).toContainText('Completed sets 2');
  await reopened.reload();
  await expect(reopened.getByRole('heading', { name: 'Workout Complete' })).toBeVisible();
  await reopened.getByRole('link', { name: 'Done', exact: true }).click();
  await expect(reopened.getByRole('link', { name: 'Resume Workout' })).toHaveCount(0);
});

test('uses completed history for suggestions and keeps historical units after unit changes', async ({
  page,
}) => {
  await prepare(page);
  await record(page, 1, '100', '12');
  await finish(page);
  await page.getByRole('link', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Start Workout' }).click();
  await expect(page.getByRole('region', { name: 'Last Time' })).toContainText('100 lb × 12');
  const card = page.getByRole('region', { name: 'Set 1', exact: true });
  await expect(card.getByRole('textbox', { name: 'Weight' })).toHaveValue('100');
  await expect(card.getByRole('textbox', { name: 'Reps' })).toHaveValue('12');
  await expect(card.getByRole('button', { name: '✓ Complete Set' })).toBeVisible();
  await record(page, 1, '105', '11');
  await finish(page);
  await page.goto('/exercises');
  await page.getByRole('link', { name: /Chest Press Seat 7/ }).click();
  await page.getByLabel('Weight unit').selectOption('kg');
  await page.getByRole('button', { name: 'Save Exercise' }).click();
  await expect(page).toHaveURL('/exercises');
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Workout' }).click();
  await expect(page.getByRole('region', { name: 'Last Time' })).toContainText('105 lb × 11');
  await expect(card.getByRole('textbox', { name: 'Weight' })).toHaveValue('');
  await expect(card.getByRole('textbox', { name: 'Reps' })).toHaveValue('11');
  await expect(card).toContainText('(kg)');
  await card.getByRole('button', { name: '✓ Complete Set' }).click();
  await expect(card.getByRole('alert')).toContainText('Enter weight and reps');
  await record(page, 1, '47.5', '11');
  await expect(card).toContainText('47.5 kg × 11 reps');
});
