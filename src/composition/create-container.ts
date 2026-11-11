import { FindExistingApplication } from '@/src/application/use-cases/find-existing-application';
import { LinkApplication } from '@/src/application/use-cases/link-application';
import { SyncApplicationCatalog } from '@/src/application/use-cases/sync-application-catalog';
import { ValidateSpreadsheetConfig } from '@/src/application/use-cases/validate-spreadsheet-config';
import { CachedApplicationCatalog } from '@/src/infrastructure/chrome/cached-application-catalog';
import { ChromeApplicationSnapshotStore } from '@/src/infrastructure/chrome/chrome-application-snapshot-store';
import { ChromeSpreadsheetSettingsStore } from '@/src/infrastructure/chrome/chrome-spreadsheet-settings-store';
import { ChromeSyncFailureNotifier } from '@/src/infrastructure/chrome/chrome-sync-failure-notifier';
import { ChromeGoogleAuth } from '@/src/infrastructure/google/chrome-google-auth';
import { GoogleSheetsGateway } from '@/src/infrastructure/google/google-sheets-gateway';

export function createContainer() {
  const settings = new ChromeSpreadsheetSettingsStore();
  const snapshots = new ChromeApplicationSnapshotStore();
  const sheets = new GoogleSheetsGateway(new ChromeGoogleAuth());
  const catalog = new CachedApplicationCatalog(sheets, snapshots);
  const syncNotifier = new ChromeSyncFailureNotifier();
  const syncApplicationCatalog = new SyncApplicationCatalog(
    catalog,
    settings,
    syncNotifier,
  );

  return {
    settings,
    snapshots,
    syncNotifier,
    syncApplicationCatalog,
    validateSpreadsheetConfig: new ValidateSpreadsheetConfig(sheets, settings),
    findExistingApplication: new FindExistingApplication(catalog, settings),
    linkApplication: new LinkApplication(
      catalog,
      sheets,
      settings,
      syncApplicationCatalog,
    ),
  };
}
