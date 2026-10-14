import type { SavedSpreadsheetSettings } from '@/src/application/dto/spreadsheet-messages';
import type { AnnualSheetSnapshot } from '@/src/domain/spreadsheet/structure';

export type { SavedSpreadsheetSettings };

export type SpreadsheetRead =
  | {
      status: 'ok';
      title: string;
      annualTitles: string[];
      sheets: AnnualSheetSnapshot[];
    }
  | { status: 'access_denied'; cause?: 'sheets_api_disabled' }
  | { status: 'unauthenticated' }
  | { status: 'oauth_not_configured' }
  | { status: 'unavailable'; detail?: string };

export type WriteProbe =
  | { status: 'ok' }
  | { status: 'denied' }
  | Exclude<SpreadsheetRead, { status: 'ok' }>;

export interface SpreadsheetReader {
  readStructure(spreadsheetId: string): Promise<SpreadsheetRead>;
  probeWriteAccess(spreadsheetId: string): Promise<WriteProbe>;
}

export interface SpreadsheetSettingsRepository {
  save(settings: SavedSpreadsheetSettings): Promise<void>;
  load(): Promise<SavedSpreadsheetSettings | null>;
}
