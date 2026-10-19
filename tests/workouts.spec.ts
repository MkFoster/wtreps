import { expect, test, type Page } from '@playwright/test';

async function prepareCircuit(page: Page) {
  for (const name of ['Chest Press', 'Leg Press']) {
    await page.goto('/exercises/new');
    await page.getByLabel('Exercise name').fill(name);
    await page.getByRole('group', { name: 'Setting 1', exact: true }).getByLabel('Value').fill('7');
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
}

test('starts, reloads, resumes and abandons a persistent workout', async ({ page, context }) => {
  await prepareCircuit(page);
  await page.getByRole('link', { name: '+ New Circuit' }).click();
  await page.getByLabel('Circuit name').fill('Empty Circuit');
  await page.getByRole('button', { name: 'Save Circuit' }).click();
  await expect(page).toHaveURL('/circuits');
  await page.goto('/');
  const empty = page.getByRole('region', { name: 'Empty Circuit', exact: true });
  await expect(empty).toContainText('Add exercises before starting a workout.');
  await expect(empty.getByRole('button', { name: 'Start Workout' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start Workout' }).click();
  await expect(page).toHaveURL(/\/workout\/[0-9a-f-]+$/);
  const workoutUrl = page.url();
  await expect(page.getByRole('heading', { name: 'Chest Press' })).toBeVisible();
  await expect(page.getByText('1 of 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Machine Settings' })).toContainText('Seat 7');
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('Workout in progress');
  await expect(page.getByRole('heading', { name: 'Chest Press' })).toBeVisible();
  await page.getByRole('link', { name: /Home/ }).click();
  const resume = page.getByRole('region', { name: 'Workout in Progress', exact: true });
  await expect(resume).toContainText('Full Body');
  await expect(resume).toContainText('Exercise 1 of 2');
  await expect(page.getByRole('button', { name: 'Start Workout' })).toBeDisabled();
  const otherTab = await context.newPage();
  await otherTab.goto('/');
  await expect(otherTab.getByRole('link', { name: 'Resume Workout' })).toBeVisible();
  await expect(otherTab.getByRole('button', { name: 'Start Workout' })).toBeDisabled();
  await page.getByRole('link', { name: 'Resume Workout' }).click();
  await expect(page).toHaveURL(workoutUrl);
  await page.screenshot({ path: 'test-results/workout-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Abandon Workout', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Abandon Workout?' });
  await expect(dialog).toContainText('Completed sets from this workout will not appear');
  await dialog.getByRole('button', { name: 'Keep Workout' }).click();
  await expect(page.getByRole('status')).toHaveText('Workout in progress');
  await page.getByRole('button', { name: 'Abandon Workout', exact: true }).click();
  await dialog.getByRole('button', { name: 'Abandon Workout', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: 'Resume Workout' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start Workout' })).toBeEnabled();
  await expect(otherTab.getByRole('link', { name: 'Resume Workout' })).toHaveCount(0);
  await expect(otherTab.getByRole('button', { name: 'Start Workout' })).toBeEnabled();
  await page.goto(workoutUrl);
  await expect(page.getByRole('status')).toHaveText('Workout abandoned');
  await expect(page.getByRole('heading', { name: 'Chest Press' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abandon Workout' })).toHaveCount(0);
});

test('reopens and resumes a workout offline without in-memory state', async ({ page, context }) => {
  await prepareCircuit(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.getByRole('button', { name: 'Start Workout' }).click();
  await expect(page.getByRole('heading', { name: 'Chest Press' })).toBeVisible();
  const workoutUrl = page.url();
  await page.close();
  await context.setOffline(true);
  const reopened = await context.newPage();
  await reopened.goto(workoutUrl);
  await expect(reopened.getByRole('status')).toHaveText('Workout in progress');
  await expect(reopened.getByRole('heading', { name: 'Chest Press' })).toBeVisible();
  await reopened.getByRole('link', { name: /Home/ }).click();
  await expect(reopened.getByRole('link', { name: 'Resume Workout' })).toBeVisible();
  await reopened.reload();
  await reopened.getByRole('link', { name: 'Resume Workout' }).click();
  await expect(reopened).toHaveURL(workoutUrl);
  await reopened.getByRole('button', { name: 'Abandon Workout', exact: true }).click();
  await reopened.getByRole('dialog').getByRole('button', { name: 'Abandon Workout' }).click();
  await expect(reopened).toHaveURL('/');
  await expect(reopened.getByRole('link', { name: 'Resume Workout' })).toHaveCount(0);
  await expect(reopened.getByRole('button', { name: 'Start Workout' })).toBeEnabled();
});
