import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StoredApplication } from '@/src/domain/spreadsheet/applications';
import { ChromeApplicationSnapshotStore } from '@/src/infrastructure/chrome/chrome-application-snapshot-store';
import {
  ChromeSyncFailureNotifier,
  SPREADSHEET_SYNC_NOTIFICATION_ID,
} from '@/src/infrastructure/chrome/chrome-sync-failure-notifier';

const row: StoredApplication = {
  sheet: '2026',
  row: 12,
  lastRow: 20,
  url: 'https://www.linkedin.com/jobs/view/1/',
  status: '',
  appliedOn: '2026-11-01',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ChromeApplicationSnapshotStore', () => {
  it('round-trips a copy and ignores another spreadsheet', async () => {
    const storage = new Map<string, unknown>();
    stubStorage(storage);
    const store = new ChromeApplicationSnapshotStore();

    await store.save('sheet', [row]);

    await expect(store.load('sheet')).resolves.toEqual([row]);
    await expect(store.load('other')).resolves.toBeNull();

    storage.set('spreadsheetApplications', {
      spreadsheetId: 'sheet',
      rows: [{}],
    });
    await expect(store.load('sheet')).resolves.toBeNull();

    await store.clear();
    await expect(store.load('sheet')).resolves.toBeNull();
  });
});

describe('ChromeSyncFailureNotifier', () => {
  it('posts one failure notification and can clear it', async () => {
    const create = vi.fn(() => Promise.resolve('id'));
    const clear = vi.fn(() => Promise.resolve(true));

    vi.stubGlobal('browser', {
      notifications: { create, clear },
      runtime: {
        getURL: (path: string) =>
          `chrome-extension://id${path.startsWith('/') ? path : `/${path}`}`,
      },
    });

    const notifier = new ChromeSyncFailureNotifier();
    await notifier.failed('La synchronisation du tableur a échoué.');
    await notifier.cleared();

    expect(create).toHaveBeenCalledWith(SPREADSHEET_SYNC_NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: 'chrome-extension://id/images/logo-128.png',
      title: 'Job Tracker',
      message: 'La synchronisation du tableur a échoué.',
    });
    expect(clear).toHaveBeenCalledWith(SPREADSHEET_SYNC_NOTIFICATION_ID);
  });
});

function stubStorage(storage: Map<string, unknown>): void {
  vi.stubGlobal('browser', {
    storage: {
      local: {
        get: (key: string) => Promise.resolve({ [key]: storage.get(key) }),
        set: (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) {
            storage.set(key, value);
          }

          return Promise.resolve();
        },
        remove: (key: string) => {
          storage.delete(key);
          return Promise.resolve();
        },
      },
    },
  });
}
