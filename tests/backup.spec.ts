import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { backupFixture } from '../src/test/backupFixture.js';
import { validateBackup, type Backup } from '../src/lib/validation/exportSchema.js';

async function chooseBackup(page: Page, backup: unknown) {
  await page.getByLabel('Backup file').setInputFiles({
    name: 'wtreps-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
}
async function replaceBackup(page: Page, backup: Backup) {
  await chooseBackup(page, backup);
  await page
    .getByRole('dialog', { name: 'Import Backup?' })
    .getByRole('button', { name: 'Replace Data', exact: true })
    .click();
  await expect(page.getByText('Backup restored', { exact: true })).toBeVisible();
}
async function createData(page: Page) {
  await page.goto('/exercises/new');
  await page.getByLabel('Exercise name').fill('Chest Press');
  await page.getByRole('group', { name: 'Setting 1', exact: true }).getByLabel('Value').fill('7');
  await page.getByRole('button', { name: 'Save Exercise' }).click();
  await expect(page).toHaveURL('/exercises');
  await page.goto('/circuits/new');
  await page.getByLabel('Circuit name').fill('Full Body');
  await page.getByRole('button', { name: '+ Add Exercise' }).click();
  await page.getByRole('button', { name: 'Chest Press Seat 7' }).click();
  await page.getByRole('button', { name: 'Save Circuit' }).click();
  await expect(page).toHaveURL('/circuits');
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Workout' }).click();
  await page.getByRole('textbox', { name: 'Weight' }).fill('100');
  await page.getByRole('textbox', { name: 'Reps' }).fill('12');
  await page.getByRole('button', { name: '✓ Complete Set' }).click();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'End Workout', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'End Workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout Complete' })).toBeVisible();
}

test('exports and restores complete local data offline and resumes the imported position', async ({
  page,
  context,
}) => {
  await createData(page);
  await page.goto('/settings');
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByText('Local data only', { exact: true })).toBeVisible();
  await expect(page.getByText('No backup created yet')).toBeVisible();
  await page.getByLabel('Default weight unit').selectOption('kg');
  await page.reload();
  await expect(page.getByLabel('Default weight unit')).toHaveValue('kg');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Backup', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^wtreps-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = validateBackup(JSON.parse(await readFile((await download.path())!, 'utf8')));
  expect(backup.schemaVersion).toBe(2);
  expect(backup.exercises[0]!.name).toBe('Chest Press');
  expect(backup.workouts[0]!.status).toBe('completed');
  expect(backup.workoutExercises[0]!.weightUnit).toBe('lb');
  expect(backup.appSettings.weightUnit).toBe('kg');
  expect(backup.appSettings.lastExportAt).toBeNull();
  await expect(page.getByText('Backup exported', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Last backup:/)).toBeVisible();
  await page.getByLabel('Backup file').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{invalid'),
  });
  await expect(page.getByRole('alert')).toContainText('Your current data was not changed.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Dismiss' }).click();
  const imported = backupFixture();
  await chooseBackup(page, imported);
  await expect(page.getByRole('dialog')).toContainText(
    'permanently removed unless you export it first',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await page.goto('/exercises');
  await expect(page.getByRole('link', { name: 'Chest Press Seat 7', exact: true })).toBeVisible();
  await page.goto('/settings');
  await replaceBackup(page, imported);
  await expect(page.getByLabel('Default weight unit')).toHaveValue('kg');
  await expect(page.getByText('No backup created yet')).toBeVisible();
  await page.screenshot({ path: 'test-results/settings-mobile.png', fullPage: true });
  await page.goto('/exercises');
  await expect(
    page.getByRole('link', { name: 'Imported Chest Press Seat 7', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Chest Press Seat 7', exact: true })).toHaveCount(0);
  await page.goto('/circuits');
  await expect(
    page.getByRole('link', { name: 'Imported Full Body 2 exercises', exact: true }),
  ).toBeVisible();
  await page.goto('/history');
  await expect(
    page.getByRole('list', { name: 'Completed workouts' }).getByRole('link'),
  ).toHaveCount(1);
  await expect(page.getByRole('list')).toContainText('Historical Circuit');
  await page.goto('/');
  await expect(
    page.getByRole('region', { name: 'Workout in Progress', exact: true }),
  ).toContainText('Exercise 2 of 2');
  await page.getByRole('link', { name: 'Resume Workout' }).click();
  await expect(page.getByRole('heading', { name: 'Historical Leg Press' })).toBeVisible();
  await expect(page.getByText('2 of 2', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Historical Leg Press' })).toBeVisible();
});

test('rejects newer backups without replacing an active Workout and removes Resume on a later valid replacement', async ({
  page,
}) => {
  const backup = backupFixture();
  await page.goto('/settings');
  await replaceBackup(page, backup);
  await chooseBackup(page, { ...backup, schemaVersion: 3 });
  await expect(page.getByRole('alert')).toContainText('newer version of WtReps');
  await expect(page.getByRole('alert')).toContainText('Update WtReps and try again.');
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Resume Workout' })).toBeVisible();
  const replacement = backupFixture();
  replacement.workouts = [];
  replacement.workoutExercises = [];
  replacement.workoutExerciseSettings = [];
  replacement.workoutSets = [];
  replacement.appSettings.weightUnit = 'lb';
  await page.goto('/settings');
  await replaceBackup(page, replacement);
  await expect(page.getByLabel('Default weight unit')).toHaveValue('lb');
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Resume Workout' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start Workout' })).toBeEnabled();
});

test('requests persistent storage only through the explicit action', async ({ page }) => {
  await page.addInitScript(() => {
    let granted = false;
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persisted: async () => granted,
        persist: async () => {
          granted = true;
          return true;
        },
      },
    });
  });
  await page.goto('/settings');
  await expect(page.getByText('Persistent storage: Not enabled', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Request Persistent Storage' }).click();
  await expect(page.getByText('Persistent storage: Enabled', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request Persistent Storage' })).toHaveCount(0);
});
