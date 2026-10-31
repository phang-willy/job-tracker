import type { SpreadsheetSettingsRepository } from '@/src/application/ports/spreadsheet';
import type { ApplicationCatalog } from '@/src/application/ports/spreadsheet';
import {
  findMatchingApplication,
  type StoredApplication,
} from '@/src/domain/spreadsheet/applications';

export type ExistingApplicationLookup =
  | { status: 'found'; application: StoredApplication }
  | { status: 'missing' }
  | { status: 'not_configured' }
  | Exclude<
      Awaited<ReturnType<ApplicationCatalog['listApplications']>>,
      { status: 'ok' }
    >;

export type TrackedApplicationsLookup =
  | {
      status: 'ok';
      matches: Array<
        | { url: string; status: 'missing' }
        | { url: string; status: 'found'; application: StoredApplication }
      >;
    }
  | Exclude<ExistingApplicationLookup, { status: 'found' | 'missing' }>;

export class FindExistingApplication {
  constructor(
    private readonly catalog: ApplicationCatalog,
    private readonly settings: SpreadsheetSettingsRepository,
  ) {}

  async execute(url: string): Promise<ExistingApplicationLookup> {
    const saved = await this.settings.load();

    if (saved === null || saved.spreadsheetId.trim() === '') {
      return { status: 'not_configured' };
    }

    const listed = await this.catalog.listApplications(saved.spreadsheetId);

    if (listed.status !== 'ok') {
      return listed;
    }

    const application = findMatchingApplication(listed.rows, url);

    if (application === null) {
      return { status: 'missing' };
    }

    return { status: 'found', application };
  }

  async executeMany(
    urls: readonly string[],
  ): Promise<TrackedApplicationsLookup> {
    const saved = await this.settings.load();

    if (saved === null || saved.spreadsheetId.trim() === '') {
      return { status: 'not_configured' };
    }

    const listed = await this.catalog.listApplications(saved.spreadsheetId);

    if (listed.status !== 'ok') {
      return listed;
    }

    return {
      status: 'ok',
      matches: urls.map((url) => {
        const application = findMatchingApplication(listed.rows, url);

        return application === null
          ? { url, status: 'missing' as const }
          : { url, status: 'found' as const, application };
      }),
    };
  }
}
