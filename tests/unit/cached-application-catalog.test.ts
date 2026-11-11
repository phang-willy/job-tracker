import { describe, expect, it, vi } from 'vitest';
import type { ApplicationSnapshotStore } from '@/src/application/ports/spreadsheet';
import type { StoredApplication } from '@/src/domain/spreadsheet/applications';
import {
  CachedApplicationCatalog,
  SPREADSHEET_READ_RETRY_MS,
} from '@/src/infrastructure/chrome/cached-application-catalog';

const row: StoredApplication = {
  sheet: '2026',
  row: 12,
  lastRow: 20,
  url: 'https://www.linkedin.com/jobs/view/1/',
  status: 'Envoyée',
  appliedOn: '2026-11-01',
};

describe('CachedApplicationCatalog', () => {
  it('serves the stored copy without reading the spreadsheet', async () => {
    const listApplications = vi.fn();
    const snapshots = memorySnapshots();
    await snapshots.save('sheet', [row]);

    await expect(
      new CachedApplicationCatalog(
        { listApplications },
        snapshots,
      ).listApplications('sheet'),
    ).resolves.toEqual({ status: 'ok', rows: [row] });
    expect(listApplications).not.toHaveBeenCalled();
  });

  it('treats an empty copy as a successful read', async () => {
    const listApplications = vi.fn();
    const snapshots = memorySnapshots();
    await snapshots.save('sheet', []);

    await expect(
      new CachedApplicationCatalog(
        { listApplications },
        snapshots,
      ).listApplications('sheet'),
    ).resolves.toEqual({ status: 'ok', rows: [] });
    expect(listApplications).not.toHaveBeenCalled();
  });

  it('copies the spreadsheet into storage when the copy is missing', async () => {
    const listApplications = vi.fn(() =>
      Promise.resolve({ status: 'ok' as const, rows: [row] }),
    );
    const snapshots = memorySnapshots();
    const catalog = new CachedApplicationCatalog(
      { listApplications },
      snapshots,
    );

    await expect(catalog.listApplications('sheet')).resolves.toEqual({
      status: 'ok',
      rows: [row],
    });
    await expect(snapshots.load('sheet')).resolves.toEqual([row]);
    await expect(catalog.listApplications('sheet')).resolves.toEqual({
      status: 'ok',
      rows: [row],
    });
    expect(listApplications).toHaveBeenCalledOnce();
  });

  it('shares one spreadsheet read between overlapping refreshes', async () => {
    let release: (value: {
      status: 'ok';
      rows: StoredApplication[];
    }) => void = () => undefined;
    const listApplications = vi.fn(
      () =>
        new Promise<{ status: 'ok'; rows: StoredApplication[] }>((resolve) => {
          release = resolve;
        }),
    );
    const catalog = new CachedApplicationCatalog(
      { listApplications },
      memorySnapshots(),
    );
    const first = catalog.refresh('sheet');
    const second = catalog.refresh('sheet');

    release({ status: 'ok', rows: [row] });

    await expect(first).resolves.toEqual({ status: 'ok', rows: [row] });
    await expect(second).resolves.toEqual({ status: 'ok', rows: [row] });
    expect(listApplications).toHaveBeenCalledOnce();
  });

  it('keeps the previous copy when the spreadsheet read fails', async () => {
    const listApplications = vi.fn(() =>
      Promise.resolve({
        status: 'unavailable' as const,
        detail: '429 Quota exceeded',
      }),
    );
    const snapshots = memorySnapshots();
    await snapshots.save('sheet', [row]);
    const catalog = new CachedApplicationCatalog(
      { listApplications },
      snapshots,
    );

    await expect(catalog.refresh('sheet')).resolves.toEqual({
      status: 'unavailable',
      detail: '429 Quota exceeded',
    });
    await expect(catalog.listApplications('sheet')).resolves.toEqual({
      status: 'ok',
      rows: [row],
    });
    expect(listApplications).toHaveBeenCalledOnce();
  });

  it('waits before reading the spreadsheet again after a failed lookup', async () => {
    let now = 1_000;
    const listApplications = vi.fn(() =>
      Promise.resolve({
        status: 'unavailable' as const,
        detail: '429 Quota exceeded',
      }),
    );
    const catalog = new CachedApplicationCatalog(
      { listApplications },
      memorySnapshots(),
      () => now,
    );

    await catalog.listApplications('sheet');
    await catalog.listApplications('sheet');
    expect(listApplications).toHaveBeenCalledOnce();

    await expect(catalog.refresh('sheet')).resolves.toMatchObject({
      status: 'unavailable',
    });
    expect(listApplications).toHaveBeenCalledTimes(2);

    now += SPREADSHEET_READ_RETRY_MS;
    await catalog.listApplications('sheet');
    expect(listApplications).toHaveBeenCalledTimes(3);
  });

  it('reports a storage write failure as unavailable', async () => {
    const snapshots: ApplicationSnapshotStore = {
      load: () => Promise.resolve(null),
      save: () => Promise.reject(new Error('quota')),
      clear: () => Promise.resolve(),
    };
    const catalog = new CachedApplicationCatalog(
      {
        listApplications: () => Promise.resolve({ status: 'ok', rows: [row] }),
      },
      snapshots,
    );

    await expect(catalog.refresh('sheet')).resolves.toEqual({
      status: 'unavailable',
      detail: 'quota',
    });
  });
});

function memorySnapshots(): ApplicationSnapshotStore {
  let snapshot: { spreadsheetId: string; rows: StoredApplication[] } | null =
    null;

  return {
    load: (spreadsheetId) =>
      Promise.resolve(
        snapshot?.spreadsheetId === spreadsheetId ? snapshot.rows : null,
      ),
    save: (spreadsheetId, rows) => {
      snapshot = { spreadsheetId, rows: [...rows] };
      return Promise.resolve();
    },
    clear: () => {
      snapshot = null;
      return Promise.resolve();
    },
  };
}
