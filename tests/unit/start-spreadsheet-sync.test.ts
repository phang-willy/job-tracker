import { describe, expect, it, vi } from 'vitest';
import {
  SPREADSHEET_SYNC_ALARM,
  SPREADSHEET_SYNC_PERIOD_MINUTES,
  startSpreadsheetSync,
} from '@/src/infrastructure/chrome/start-spreadsheet-sync';

describe('startSpreadsheetSync', () => {
  it('runs the copy from the alarm and leaves an existing alarm in place', async () => {
    const execute = vi.fn(() => Promise.resolve('synced'));
    const create = vi.fn(() => Promise.resolve());
    const alarmListeners: Array<(alarm: { name: string }) => void> = [];
    let installed: () => void = () => undefined;
    let startup: () => void = () => undefined;

    startSpreadsheetSync(
      { execute },
      host({
        get: () => Promise.resolve({ name: SPREADSHEET_SYNC_ALARM }),
        create,
        onAlarm: (listener) => {
          alarmListeners.push(listener);
        },
        onInstalled: (listener) => {
          installed = listener;
        },
        onStartup: (listener) => {
          startup = listener;
        },
      }),
    );

    await flush();
    expect(create).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();

    alarmListeners[0]?.({ name: 'other' });
    expect(execute).not.toHaveBeenCalled();

    alarmListeners[0]?.({ name: SPREADSHEET_SYNC_ALARM });
    expect(execute).toHaveBeenCalledOnce();

    installed();
    startup();
    expect(create).toHaveBeenCalledWith(SPREADSHEET_SYNC_ALARM, {
      periodInMinutes: SPREADSHEET_SYNC_PERIOD_MINUTES,
    });
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('creates the 10 minute alarm when it is missing, without an extra copy', async () => {
    const execute = vi.fn(() => Promise.resolve('synced'));
    const create = vi.fn(() => Promise.resolve());

    startSpreadsheetSync(
      { execute },
      host({
        get: () => Promise.resolve(undefined),
        create,
        onAlarm: () => undefined,
        onInstalled: () => undefined,
        onStartup: () => undefined,
      }),
    );

    await flush();
    expect(create).toHaveBeenCalledWith(SPREADSHEET_SYNC_ALARM, {
      periodInMinutes: 10,
    });
    expect(execute).not.toHaveBeenCalled();
  });
});

function host(input: {
  get: () => Promise<{ name: string } | undefined>;
  create: (name: string, info: { periodInMinutes: number }) => Promise<void>;
  onAlarm: (listener: (alarm: { name: string }) => void) => void;
  onInstalled: (listener: () => void) => void;
  onStartup: (listener: () => void) => void;
}) {
  return {
    alarms: {
      get: input.get,
      create: input.create,
      onAlarm: { addListener: input.onAlarm },
    },
    runtime: {
      onInstalled: { addListener: input.onInstalled },
      onStartup: { addListener: input.onStartup },
    },
  };
}

function flush(): Promise<void> {
  return Promise.resolve().then(() => undefined);
}
