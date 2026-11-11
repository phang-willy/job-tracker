import { logVerify } from '@/src/infrastructure/logging/verify-log';

export const SPREADSHEET_SYNC_ALARM = 'sync-application-catalog';
export const SPREADSHEET_SYNC_PERIOD_MINUTES = 10;

type SpreadsheetSyncHost = {
  alarms: {
    get(name: string): Promise<{ name: string } | undefined>;
    create(name: string, info: { periodInMinutes: number }): Promise<void>;
    onAlarm: {
      addListener(listener: (alarm: { name: string }) => void): void;
    };
  };
  runtime: {
    onInstalled: { addListener(listener: () => void): void };
    onStartup: { addListener(listener: () => void): void };
  };
};

export function startSpreadsheetSync(
  sync: { execute(): Promise<unknown> },
  host: SpreadsheetSyncHost = browser as unknown as SpreadsheetSyncHost,
): void {
  const run = () => {
    void sync.execute().catch((error: unknown) => {
      logVerify('sync.error', error);
    });
  };

  host.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== SPREADSHEET_SYNC_ALARM) {
      return;
    }

    run();
  });

  host.runtime.onInstalled.addListener(() => {
    void host.alarms.create(SPREADSHEET_SYNC_ALARM, {
      periodInMinutes: SPREADSHEET_SYNC_PERIOD_MINUTES,
    });
    run();
  });

  host.runtime.onStartup.addListener(() => {
    run();
  });

  void host.alarms.get(SPREADSHEET_SYNC_ALARM).then((existing) => {
    if (existing != null) {
      return;
    }

    return host.alarms.create(SPREADSHEET_SYNC_ALARM, {
      periodInMinutes: SPREADSHEET_SYNC_PERIOD_MINUTES,
    });
  });
}
