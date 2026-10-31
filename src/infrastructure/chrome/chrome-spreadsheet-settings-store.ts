import type {
  SavedSpreadsheetSettings,
  SpreadsheetSettingsRepository,
} from '@/src/application/ports/spreadsheet';
import { savedSpreadsheetSettingsSchema } from '@/src/application/dto/spreadsheet-messages';

const STORAGE_KEY = 'spreadsheetSettings';

export class ChromeSpreadsheetSettingsStore implements SpreadsheetSettingsRepository {
  async save(settings: SavedSpreadsheetSettings): Promise<void> {
    await browser.storage.local.set({ [STORAGE_KEY]: settings });
  }

  async load(): Promise<SavedSpreadsheetSettings | null> {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const parsed = savedSpreadsheetSettingsSchema.safeParse(
      stored[STORAGE_KEY],
    );

    return parsed.success ? parsed.data : null;
  }

  async clear(): Promise<void> {
    await browser.storage.local.remove(STORAGE_KEY);
  }
}
