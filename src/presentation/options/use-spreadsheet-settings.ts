import { useEffect, useState } from 'react';
import type { SavedSpreadsheetSettings } from '@/src/application/dto/spreadsheet-messages';
import {
  desyncSpreadsheet,
  loadSpreadsheetSettings,
  reverifySpreadsheet,
  verifySpreadsheet,
} from '@/src/presentation/options/spreadsheet-settings-client';

export function useSpreadsheetSettings(): {
  saved: SavedSpreadsheetSettings | null;
  ready: boolean;
  verify: typeof verifySpreadsheet;
  reverify: typeof reverifySpreadsheet;
  desync: typeof desyncSpreadsheet;
} {
  const [saved, setSaved] = useState<SavedSpreadsheetSettings | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadSpreadsheetSettings()
      .then((settings) => {
        if (!cancelled) {
          setSaved(settings);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSaved(null);
          setReady(true);
        }
      });

    const onChanged: Parameters<
      typeof browser.storage.onChanged.addListener
    >[0] = (changes, areaName) => {
      if (
        cancelled ||
        areaName !== 'local' ||
        changes.spreadsheetSettings == null
      ) {
        return;
      }

      void loadSpreadsheetSettings().then((settings) => {
        if (!cancelled) {
          setSaved(settings);
        }
      });
    };

    browser.storage.onChanged.addListener(onChanged);

    return () => {
      cancelled = true;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return {
    saved,
    ready,
    verify: verifySpreadsheet,
    reverify: reverifySpreadsheet,
    desync: desyncSpreadsheet,
  };
}
