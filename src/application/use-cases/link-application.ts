import type { SavedSpreadsheetSettings } from '@/src/application/dto/spreadsheet-messages';
import type {
  ApplicationCatalog,
  ApplicationInsertResult,
  ApplicationWriter,
  SpreadsheetSettingsRepository,
} from '@/src/application/ports/spreadsheet';
import {
  findMatchingApplication,
  type StoredApplication,
} from '@/src/domain/spreadsheet/applications';
import type { ApplicationDraft } from '@/src/domain/spreadsheet/application-draft';
import { sheetSerialFromCivilDate } from '@/src/domain/spreadsheet/sheet-date';

export type LinkApplicationResult =
  | { status: 'found'; application: StoredApplication }
  | { status: 'invalid'; field: 'company' | 'title' | 'url' | 'date' }
  | { status: 'unconfirmed' }
  | { status: 'not_configured' }
  | Exclude<ApplicationInsertResult, { status: 'inserted' }>;

export class LinkApplication {
  constructor(
    private readonly catalog: ApplicationCatalog,
    private readonly writer: ApplicationWriter,
    private readonly settings: SpreadsheetSettingsRepository,
  ) {}

  async execute(input: ApplicationDraft): Promise<LinkApplicationResult> {
    const draft = normalizeDraft(input);
    const invalid = invalidDraft(draft);

    if (invalid != null) {
      return invalid;
    }

    const saved = await this.settings.load();

    if (saved == null || saved.spreadsheetId.trim() === '') {
      return { status: 'not_configured' };
    }

    const listed = await this.catalog.listApplications(saved.spreadsheetId);

    if (listed.status !== 'ok') {
      return listed;
    }

    const existing = findMatchingApplication(listed.rows, draft.url);

    if (existing != null) {
      return { status: 'found', application: existing };
    }

    const inserted = await this.writer.insertApplication(
      saved.spreadsheetId,
      draft,
    );

    if (inserted.status === 'inserted') {
      await this.rememberWriteAccess(saved, 'verified');
      return this.readBack(saved.spreadsheetId, draft.url);
    }

    if (inserted.status === 'denied') {
      await this.rememberWriteAccess(saved, 'denied');
      return inserted;
    }

    if (inserted.status === 'missing_sheet' || inserted.status === 'unsorted') {
      return inserted;
    }

    const recovered = await this.recover(saved.spreadsheetId, draft.url);

    return recovered ?? inserted;
  }

  private async rememberWriteAccess(
    saved: SavedSpreadsheetSettings,
    writeAccess: SavedSpreadsheetSettings['writeAccess'],
  ): Promise<void> {
    if (saved.writeAccess === writeAccess) {
      return;
    }

    await this.settings.save({ ...saved, writeAccess });
  }

  private async readBack(
    spreadsheetId: string,
    url: string,
  ): Promise<LinkApplicationResult> {
    const listed = await this.catalog.listApplications(spreadsheetId);

    if (listed.status !== 'ok') {
      return listed;
    }

    const application = findMatchingApplication(listed.rows, url);

    return application == null
      ? { status: 'unconfirmed' }
      : { status: 'found', application };
  }

  private async recover(
    spreadsheetId: string,
    url: string,
  ): Promise<LinkApplicationResult | null> {
    const listed = await this.catalog.listApplications(spreadsheetId);

    if (listed.status !== 'ok') {
      return null;
    }

    const application = findMatchingApplication(listed.rows, url);

    return application == null ? null : { status: 'found', application };
  }
}

function normalizeDraft(draft: ApplicationDraft): ApplicationDraft {
  return {
    company: draft.company.trim(),
    country: draft.country.trim(),
    region: draft.region.trim(),
    city: draft.city.trim(),
    title: draft.title.trim(),
    monthlySalary: draft.monthlySalary.trim(),
    annualSalary: draft.annualSalary.trim(),
    appliedOn: draft.appliedOn.trim(),
    contractType: draft.contractType.trim(),
    url: draft.url.trim(),
  };
}

function invalidDraft(
  draft: ApplicationDraft,
): { status: 'invalid'; field: 'company' | 'title' | 'url' | 'date' } | null {
  if (draft.company === '') {
    return { status: 'invalid', field: 'company' };
  }

  if (draft.title === '') {
    return { status: 'invalid', field: 'title' };
  }

  if (draft.url === '') {
    return { status: 'invalid', field: 'url' };
  }

  if (sheetSerialFromCivilDate(draft.appliedOn) == null) {
    return { status: 'invalid', field: 'date' };
  }

  return null;
}
