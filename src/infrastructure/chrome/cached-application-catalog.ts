import type {
  ApplicationCatalog,
  ApplicationCatalogRead,
  ApplicationSnapshotStore,
  RefreshableApplicationCatalog,
} from '@/src/application/ports/spreadsheet';

export const SPREADSHEET_READ_RETRY_MS = 10 * 60 * 1000;

export class CachedApplicationCatalog implements RefreshableApplicationCatalog {
  private pending: Promise<ApplicationCatalogRead> | null = null;
  private pendingId: string | null = null;
  private readonly failures = new Map<
    string,
    {
      at: number;
      result: Exclude<ApplicationCatalogRead, { status: 'ok' }>;
    }
  >();

  constructor(
    private readonly source: ApplicationCatalog,
    private readonly snapshots: ApplicationSnapshotStore,
    private readonly now: () => number = Date.now,
  ) {}

  async listApplications(
    spreadsheetId: string,
  ): Promise<ApplicationCatalogRead> {
    const rows = await this.snapshots.load(spreadsheetId);

    if (rows != null) {
      return { status: 'ok', rows };
    }

    const cooled = this.failures.get(spreadsheetId);

    if (cooled != null && this.now() - cooled.at < SPREADSHEET_READ_RETRY_MS) {
      return cooled.result;
    }

    return this.refresh(spreadsheetId);
  }

  refresh(spreadsheetId: string): Promise<ApplicationCatalogRead> {
    if (this.pending != null && this.pendingId === spreadsheetId) {
      return this.pending;
    }

    const pending = this.readThrough(spreadsheetId).finally(() => {
      if (this.pending === pending) {
        this.pending = null;
        this.pendingId = null;
      }
    });
    this.pending = pending;
    this.pendingId = spreadsheetId;

    return pending;
  }

  private async readThrough(
    spreadsheetId: string,
  ): Promise<ApplicationCatalogRead> {
    const listed = await this.source.listApplications(spreadsheetId);

    if (listed.status !== 'ok') {
      this.noteFailure(spreadsheetId, listed);
      return listed;
    }

    try {
      await this.snapshots.save(spreadsheetId, listed.rows);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const failure = { status: 'unavailable' as const, detail };
      this.noteFailure(spreadsheetId, failure);
      return failure;
    }

    this.failures.delete(spreadsheetId);
    return listed;
  }

  private noteFailure(
    spreadsheetId: string,
    result: Exclude<ApplicationCatalogRead, { status: 'ok' }>,
  ): void {
    this.failures.set(spreadsheetId, { at: this.now(), result });
  }
}
