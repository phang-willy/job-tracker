import { describe, expect, it, vi } from 'vitest';
import type { SpreadsheetSettingsRepository } from '@/src/application/ports/spreadsheet';
import {
  SyncApplicationCatalog,
  syncFailureMessage,
} from '@/src/application/use-cases/sync-application-catalog';

const saved = {
  spreadsheetId: 'sheet',
  url: 'https://docs.google.com/spreadsheets/d/sheet',
  title: 'Suivi',
  annualSheets: ['2026'],
  writeAccess: 'verified' as const,
  years: [],
};

describe('SyncApplicationCatalog', () => {
  it('does nothing when no spreadsheet is configured', async () => {
    const refresh = vi.fn();
    const failed = vi.fn();
    const cleared = vi.fn();
    const settings: SpreadsheetSettingsRepository = {
      load: () => Promise.resolve(null),
      save: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    };

    await expect(
      new SyncApplicationCatalog(
        { listApplications: vi.fn(), refresh },
        settings,
        { failed, cleared },
      ).execute(),
    ).resolves.toBe('skipped');
    expect(refresh).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
    expect(cleared).not.toHaveBeenCalled();
  });

  it('clears a previous failure notice after a successful copy', async () => {
    const failed = vi.fn();
    const cleared = vi.fn(() => Promise.resolve());
    const refresh = vi.fn(() =>
      Promise.resolve({ status: 'ok' as const, rows: [] }),
    );

    await expect(
      new SyncApplicationCatalog(
        { listApplications: vi.fn(), refresh },
        configured(),
        { failed, cleared },
      ).execute(),
    ).resolves.toBe('synced');
    expect(refresh).toHaveBeenCalledWith('sheet');
    expect(cleared).toHaveBeenCalledOnce();
    expect(failed).not.toHaveBeenCalled();
  });

  it('notifies only when the spreadsheet read fails', async () => {
    const failed = vi.fn(() => Promise.resolve());
    const cleared = vi.fn();
    const refresh = vi.fn(() =>
      Promise.resolve({
        status: 'unavailable' as const,
        detail: '429 Quota exceeded',
      }),
    );

    await expect(
      new SyncApplicationCatalog(
        { listApplications: vi.fn(), refresh },
        configured(),
        { failed, cleared },
      ).execute(),
    ).resolves.toBe('failed');
    expect(failed).toHaveBeenCalledWith(
      syncFailureMessage({
        status: 'unavailable',
        detail: '429 Quota exceeded',
      }),
    );
    expect(cleared).not.toHaveBeenCalled();
  });
});

describe('syncFailureMessage', () => {
  it('keeps the notice short when Google returns a long detail', () => {
    const message = syncFailureMessage({
      status: 'unavailable',
      detail: 'x'.repeat(400),
    });

    expect(message.startsWith('La synchronisation du tableur a échoué.')).toBe(
      true,
    );
    expect(message.length).toBeLessThanOrEqual(180);
  });
});

function configured(): SpreadsheetSettingsRepository {
  return {
    load: () => Promise.resolve(saved),
    save: () => Promise.resolve(),
    clear: () => Promise.resolve(),
  };
}
