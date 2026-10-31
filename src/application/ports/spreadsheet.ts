import type { SavedSpreadsheetSettings } from '@/src/application/dto/spreadsheet-messages';
import type { StoredApplication } from '@/src/domain/spreadsheet/applications';
import type { ApplicationDraft } from '@/src/domain/spreadsheet/application-draft';
import type { AnnualSheetSnapshot } from '@/src/domain/spreadsheet/structure';

export type { SavedSpreadsheetSettings };

export type SpreadsheetRead =
  | {
      status: 'ok';
      title: string;
      annualTitles: string[];
      sheets: AnnualSheetSnapshot[];
    }
  | {
      status: 'access_denied';
      cause?: 'sheets_api_disabled';
      notFound?: true;
    }
  | { status: 'unauthenticated' }
  | { status: 'oauth_not_configured' }
  | { status: 'unavailable'; detail?: string };

export type WriteProbe =
  | { status: 'ok' }
  | { status: 'denied' }
  | { status: 'unverified' }
  | Exclude<SpreadsheetRead, { status: 'ok' }>;

export type ApplicationCatalogRead =
  | { status: 'ok'; rows: StoredApplication[] }
  | Exclude<SpreadsheetRead, { status: 'ok' }>;

export type ApplicationInsertResult =
  | { status: 'inserted' }
  | { status: 'missing_sheet'; year: string }
  | { status: 'unsorted' }
  | { status: 'denied' }
  | Exclude<SpreadsheetRead, { status: 'ok' }>;

export interface ApplicationCatalog {
  listApplications(spreadsheetId: string): Promise<ApplicationCatalogRead>;
}

export interface ApplicationWriter {
  insertApplication(
    spreadsheetId: string,
    draft: ApplicationDraft,
  ): Promise<ApplicationInsertResult>;
}

export interface SpreadsheetReader {
  readStructure(spreadsheetId: string): Promise<SpreadsheetRead>;
  probeWriteAccess(spreadsheetId: string): Promise<WriteProbe>;
}

export interface SpreadsheetSettingsRepository {
  save(settings: SavedSpreadsheetSettings): Promise<void>;
  load(): Promise<SavedSpreadsheetSettings | null>;
  clear(): Promise<void>;
}
