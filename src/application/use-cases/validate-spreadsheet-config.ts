import type { ValidateSpreadsheetResult } from '@/src/application/dto/spreadsheet-messages';
import type {
  SavedSpreadsheetSettings,
  SpreadsheetReader,
  SpreadsheetSettingsRepository,
  WriteProbe,
} from '@/src/application/ports/spreadsheet';
import {
  assessRelevantYears,
  parseSpreadsheetId,
} from '@/src/domain/spreadsheet/structure';
import { logVerify } from '@/src/infrastructure/logging/verify-log';

export type { ValidateSpreadsheetResult };

export class ValidateSpreadsheetConfig {
  constructor(
    private readonly sheets: SpreadsheetReader,
    private readonly settings: SpreadsheetSettingsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(rawUrl: string): Promise<ValidateSpreadsheetResult> {
    const finish = (result: ValidateSpreadsheetResult) => {
      logVerify('validate.result', result);
      return result;
    };
    const spreadsheetId = parseSpreadsheetId(rawUrl);

    logVerify('validate.start', { rawUrl, spreadsheetId });

    if (spreadsheetId === null) {
      return finish({ status: 'invalid_url' });
    }

    const read = await this.sheets.readStructure(spreadsheetId);

    logVerify('validate.read', read);

    if (read.status === 'access_denied') {
      return finish({
        status: 'access_denied',
        spreadsheetId,
        ...(read.cause === 'sheets_api_disabled'
          ? { cause: 'sheets_api_disabled' as const }
          : {}),
        ...(read.notFound === true ? { notFound: true as const } : {}),
      });
    }

    if (read.status === 'unavailable') {
      return finish(
        read.detail == null
          ? { status: 'unavailable' }
          : { status: 'unavailable', detail: read.detail },
      );
    }

    if (read.status !== 'ok') {
      return finish({ status: read.status });
    }

    const assessed = assessRelevantYears(
      read.annualTitles,
      read.sheets,
      this.now().getFullYear(),
    );

    if (assessed.problems.length > 0) {
      await this.settings.save({
        spreadsheetId,
        url: rawUrl.trim(),
        title: read.title,
        annualSheets: assessed.years
          .filter((item) => item.status === 'ok')
          .map((item) => item.year),
        writeAccess: 'unverified',
        years: assessed.years,
      });

      return finish({
        status: 'incompatible',
        spreadsheetId,
        title: read.title,
        problems: assessed.problems,
        years: assessed.years,
      });
    }

    const write = await this.sheets.probeWriteAccess(spreadsheetId);
    logVerify('validate.write', write);

    if (
      write.status === 'unauthenticated' ||
      write.status === 'oauth_not_configured'
    ) {
      return finish({ status: write.status });
    }

    const saved: SavedSpreadsheetSettings = {
      spreadsheetId,
      url: rawUrl.trim(),
      title: read.title,
      annualSheets: assessed.years
        .filter((item) => item.status === 'ok')
        .map((item) => item.year),
      writeAccess: await this.confirmedWriteAccess(
        spreadsheetId,
        writeAccessFromProbe(write.status),
      ),
      years: assessed.years,
    };

    await this.settings.save(saved);

    return finish({
      status: 'compatible',
      spreadsheetId,
      url: saved.url,
      title: read.title,
      annualSheets: saved.annualSheets,
      writeAccess: saved.writeAccess,
      years: saved.years,
    });
  }

  private async confirmedWriteAccess(
    spreadsheetId: string,
    probed: SavedSpreadsheetSettings['writeAccess'],
  ): Promise<SavedSpreadsheetSettings['writeAccess']> {
    if (probed !== 'unverified') {
      return probed;
    }

    const previous = await this.settings.load();

    if (
      previous != null &&
      previous.spreadsheetId === spreadsheetId &&
      previous.writeAccess === 'verified'
    ) {
      return 'verified';
    }

    return 'unverified';
  }
}

function writeAccessFromProbe(
  status: WriteProbe['status'],
): SavedSpreadsheetSettings['writeAccess'] {
  if (status === 'ok') {
    return 'verified';
  }

  if (status === 'denied') {
    return 'denied';
  }

  return 'unverified';
}
