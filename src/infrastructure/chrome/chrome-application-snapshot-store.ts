import { existingApplicationSchema } from '@/src/application/dto/spreadsheet-messages';
import type { ApplicationSnapshotStore } from '@/src/application/ports/spreadsheet';
import type { StoredApplication } from '@/src/domain/spreadsheet/applications';
import { z } from '@/src/infrastructure/zod';

const STORAGE_KEY = 'spreadsheetApplications';

const snapshotSchema = z.object({
  spreadsheetId: z.string(),
  rows: z.array(existingApplicationSchema),
});

export class ChromeApplicationSnapshotStore implements ApplicationSnapshotStore {
  async load(spreadsheetId: string): Promise<StoredApplication[] | null> {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const parsed = snapshotSchema.safeParse(stored[STORAGE_KEY]);

    if (!parsed.success || parsed.data.spreadsheetId !== spreadsheetId) {
      return null;
    }

    return parsed.data.rows;
  }

  async save(
    spreadsheetId: string,
    rows: readonly StoredApplication[],
  ): Promise<void> {
    await browser.storage.local.set({
      [STORAGE_KEY]: {
        spreadsheetId,
        rows: rows.map((row) => ({ ...row })),
      },
    });
  }

  async clear(): Promise<void> {
    await browser.storage.local.remove(STORAGE_KEY);
  }
}
