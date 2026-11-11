import type { SyncFailureNotifier } from '@/src/application/ports/spreadsheet';
import { logVerify } from '@/src/infrastructure/logging/verify-log';

export const SPREADSHEET_SYNC_NOTIFICATION_ID = 'spreadsheet-sync-failed';

export class ChromeSyncFailureNotifier implements SyncFailureNotifier {
  async failed(message: string): Promise<void> {
    try {
      await browser.notifications.create(SPREADSHEET_SYNC_NOTIFICATION_ID, {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/images/logo-128.png'),
        title: 'Job Tracker',
        message,
      });
    } catch (error) {
      logVerify('sync.notify', error);
    }
  }

  async cleared(): Promise<void> {
    try {
      await browser.notifications.clear(SPREADSHEET_SYNC_NOTIFICATION_ID);
    } catch (error) {
      logVerify('sync.notify', error);
    }
  }
}
