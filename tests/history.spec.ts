import { expect, test, type Page } from '@playwright/test';

async function createCircuit(page: Page, name: string, exerciseName = 'Chest Press') {
  await page.goto('/circuits/new');
  await page.getByLabel('Circuit name').fill(name);
  await page.getByRole('button', { name: '+ Add Exercise' }).click();
  await page.getByRole('button', { name: `${exerciseName} Seat 7` }).click();
  await page.getByRole('button', { name: 'Save Circuit' }).click();
  await expect(page).toHaveURL('/circuits');
}
async function prepare(page: Page) {
  await page.goto('/exercises/new');
  await page.getByLabel('Exercise name').fill('Chest Press');
  await page.getByRole('group', { name: 'Setting 1', exact: true }).getByLabel('Value').fill('7');
  await page.getByRole('button', { name: 'Save Exercise' }).click();
  await expect(page).toHaveURL('/exercises');
  await createCircuit(page, 'Full Body');
}
async function complete(
  page: Page,
  circuit = 'Full Body',
  weight = '100',
  reps = '12',
  twoSets = false,
) {
  await page.goto('/');
  await page
    .getByRole('region', { name: circuit, exact: true })
    .getByRole('button', { name: 'Start Workout' })
    .click();
  const first = page.getByRole('region', { name: 'Set 1', exact: true });
  await first.getByRole('textbox', { name: 'Weight' }).fill(weight);
  await first.getByRole('textbox', { name: 'Reps' }).fill(reps);
  await first.getByRole('button', { name: '✓ Complete Set' }).click();
  await expect(first.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  if (twoSets) {
    await page.getByRole('button', { name: '+ Set', exact: true }).click();
    const second = page.getByRole('region', { name: 'Set 2', exact: true });
    await second.getByRole('textbox', { name: 'Weight' }).fill('95');
    await second.getByRole('textbox', { name: 'Reps' }).fill('10');
    await second.getByRole('button', { name: '✓ Complete Set' }).click();
    await expect(second.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'End Workout', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'End Workout?' })
    .getByRole('button', { name: 'End Workout', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Workout Complete' })).toBeVisible();
}

test('reviews, corrects and deletes historical snapshots offline while preserving templates', async ({
  page,
  context,
}) => {
  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'No workouts yet.' })).toBeVisible();
  await expect(page.getByRole('navigation')).toBeVisible();
  await prepare(page);
  await complete(page, 'Full Body', '100', '12', true);
  await page.getByRole('link', { name: 'View Workout' }).click();
  await expect(page).toHaveURL(/\/history\/[0-9a-f-]+$/);
  const detailUrl = page.url();
  await expect(page.getByRole('heading', { name: 'Full Body', exact: true })).toBeVisible();
  const exercise = page.getByRole('region', { name: 'Chest Press', exact: true });
  await expect(exercise).toContainText('Seat 7');
  await expect(exercise).toContainText('100 lb × 12 reps');
  await page.getByRole('link', { name: '‹ History' }).click();
  const list = page.getByRole('list', { name: 'Completed workouts' });
  await expect(list.getByRole('link')).toHaveCount(1);
  await expect(list).toContainText('2 sets · 1 exercise');
  await expect(list).toContainText(/\d+ (sec|min)/);
  await list.getByRole('link').click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.getByRole('link', { name: 'Edit Workout' }).click();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  const group1 = page.getByRole('group', { name: 'Set 1', exact: true });
  await group1.getByRole('textbox', { name: 'Weight' }).fill('105.5');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Discard changes?' });
  await discard.getByRole('button', { name: 'Keep Editing' }).click();
  await expect(group1.getByRole('textbox', { name: 'Weight' })).toHaveValue('105.5');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await discard.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(exercise).toContainText('100 lb × 12 reps');
  await page.getByRole('link', { name: 'Edit Workout' }).click();
  await group1.getByRole('textbox', { name: 'Weight' }).fill('105.5');
  await group1.getByRole('textbox', { name: 'Reps' }).fill('1.5');
  await page.getByRole('button', { name: 'Save Workout' }).click();
  await expect(page.getByRole('alert')).toContainText('whole-number reps');
  await group1.getByRole('textbox', { name: 'Reps' }).fill('11');
  await page.getByLabel('Seat', { exact: true }).fill('8');
  await page.getByRole('button', { name: '+ Set', exact: true }).click();
  await page.getByRole('button', { name: 'Remove Set 2', exact: true }).click();
  await page.screenshot({ path: 'test-results/history-edit-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Save Workout' }).click();
  await expect(page).toHaveURL(detailUrl);
  await expect(page.getByText('Workout updated', { exact: true })).toBeVisible();
  await expect(exercise).toContainText('105.5 lb × 11 reps');
  await expect(exercise).toContainText('95 lb × 10 reps');
  await expect(exercise).toContainText('Seat 8');
  await page.reload();
  await expect(exercise).toContainText('105.5 lb × 11 reps');
  await page.screenshot({ path: 'test-results/history-detail-mobile.png', fullPage: true });
  await page.goto('/exercises');
  await page.getByRole('link', { name: 'Chest Press Seat 7', exact: true }).click();
  await expect(
    page.getByRole('group', { name: 'Setting 1', exact: true }).getByLabel('Value'),
  ).toHaveValue('7');
  await page.goto(detailUrl);
  await page.getByRole('button', { name: 'Delete Workout', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Delete this workout?' });
  await expect(confirmation).toContainText('Full Body');
  await expect(confirmation).toContainText('permanently remove the workout and its sets');
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(exercise).toBeVisible();
  await page.getByRole('button', { name: 'Delete Workout', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Delete Workout', exact: true }).click();
  await expect(page).toHaveURL('/history');
  await expect(page.getByText('Workout deleted', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No workouts yet.' })).toBeVisible();
  await page.goto('/manage');
  await expect(page.getByRole('region', { name: 'Exercises' })).toContainText('1 exercise');
  await expect(page.getByRole('region', { name: 'Circuits' })).toContainText('1 circuit');
  await page.goto(detailUrl);
  await expect(page.getByRole('heading', { name: 'Workout unavailable' })).toBeVisible();
});

test('shows Exercise History across Circuits and renamed templates with mixed historical units', async ({
  page,
}) => {
  await prepare(page);
  await complete(page);
  await page.goto('/exercises');
  await page.getByRole('link', { name: 'Chest Press Seat 7', exact: true }).click();
  await page.getByLabel('Exercise name').fill('Renamed Chest Press');
  await page.getByLabel('Weight unit').selectOption('kg');
  await page.getByRole('button', { name: 'Save Exercise' }).click();
  await expect(page).toHaveURL('/exercises');
  await createCircuit(page, 'Upper Body', 'Renamed Chest Press');
  await complete(page, 'Upper Body', '45', '10');
  await page.goto('/exercises');
  await page.getByRole('link', { name: 'Renamed Chest Press Seat 7', exact: true }).click();
  await page.getByRole('link', { name: 'View History', exact: true }).click();
  await expect(page).toHaveURL(/\/exercises\/[0-9a-f-]+\/history$/);
  const sections = page.locator('main section');
  await expect(sections).toHaveCount(2);
  await expect(sections.nth(0)).toContainText('Upper Body');
  await expect(sections.nth(0)).toContainText('45 kg × 10 reps');
  await expect(sections.nth(1)).toContainText('Full Body');
  await expect(sections.nth(1)).toContainText('100 lb × 12 reps');
  await sections.nth(1).getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Chest Press', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Chest Press', exact: true })).toContainText(
    '100 lb × 12 reps',
  );
});
