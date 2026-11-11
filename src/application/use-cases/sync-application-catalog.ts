import type {
  ApplicationCatalogRead,
  RefreshableApplicationCatalog,
  SpreadsheetSettingsRepository,
  SyncFailureNotifier,
} from '@/src/application/ports/spreadsheet';
import { logVerify } from '@/src/infrastructure/logging/verify-log';

export class SyncApplicationCatalog {
  constructor(
    private readonly catalog: RefreshableApplicationCatalog,
    private readonly settings: SpreadsheetSettingsRepository,
    private readonly notify: SyncFailureNotifier,
  ) {}

  async execute(): Promise<'synced' | 'skipped' | 'failed'> {
    const saved = await this.settings.load();

    if (saved == null || saved.spreadsheetId.trim() === '') {
      return 'skipped';
    }

    const listed = await this.catalog.refresh(saved.spreadsheetId);

    if (listed.status === 'ok') {
      logVerify('sync.ok', { rows: listed.rows.length });
      await this.notify.cleared();
      return 'synced';
    }

    const message = syncFailureMessage(listed);
    logVerify('sync.failed', { status: listed.status, message });
    await this.notify.failed(message);
    return 'failed';
  }
}

export function syncFailureMessage(
  result: Exclude<ApplicationCatalogRead, { status: 'ok' }>,
): string {
  switch (result.status) {
    case 'unauthenticated':
      return 'La synchronisation du tableur a échoué. Connexion Google requise.';
    case 'oauth_not_configured':
      return "La synchronisation du tableur a échoué. La connexion Google n'est pas configurée.";
    case 'access_denied':
      return 'La synchronisation du tableur a échoué. Accès refusé ou classeur introuvable.';
    case 'unavailable': {
      const detail = result.detail?.trim() ?? '';
      const base = 'La synchronisation du tableur a échoué.';

      return detail === '' ? base : `${base} ${detail}`.slice(0, 180);
    }
  }
}
