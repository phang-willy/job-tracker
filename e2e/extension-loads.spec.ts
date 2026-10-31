import path from 'node:path';
import { expect, test, chromium, type Worker } from '@playwright/test';

const extensionPath = path.resolve('.output/chrome-mv3');

async function waitForServiceWorker(
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
): Promise<Worker> {
  const existing = context.serviceWorkers()[0];
  if (existing) {
    return existing;
  }

  return context.waitForEvent('serviceworker');
}

test('the popup keeps settings in a tab and stays 580 by 400', async () => {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const worker = await waitForServiceWorker(context);
    const extensionId = new URL(worker.url()).host;
    const popup = await context.newPage();

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(
      popup.getByRole('heading', { name: 'Job Tracker' }),
    ).toBeVisible();
    await expect(popup.getByLabel('Société')).toBeVisible();
    await expect(
      popup.getByText("Cette page n'est pas encore prise en charge."),
    ).toBeVisible();

    const shell = popup.locator('main');
    const box = await shell.boundingBox();
    expect(box?.width).toBe(580);
    expect(box?.height).toBeGreaterThanOrEqual(400);

    const pageCount = context.pages().length;
    await popup.getByRole('tab', { name: 'Paramètres' }).click();

    await expect(
      popup.getByRole('heading', { name: 'Paramètres' }),
    ).toBeVisible();
    await expect(popup.getByLabel('URL du classeur')).toBeVisible();
    expect(context.pages()).toHaveLength(pageCount);
  } finally {
    await context.close();
  }
});
