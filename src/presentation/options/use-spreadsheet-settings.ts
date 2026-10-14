import { useEffect, useState } from 'react';
import type { SavedSpreadsheetSettings } from '@/src/application/dto/spreadsheet-messages';
import {
  loadSpreadsheetSettings,
  reverifySpreadsheet,
  verifySpreadsheet,
} from '@/src/presentation/options/spreadsheet-settings-client';

export function useSpreadsheetSettings(): {
  saved: SavedSpreadsheetSettings | null;
  verify: typeof verifySpreadsheet;
  reverify: typeof reverifySpreadsheet;
} {
  const [saved, setSaved] = useState<SavedSpreadsheetSettings | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadSpreadsheetSettings()
      .then((settings) => {
        if (!cancelled) {
          setSaved(settings);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSaved(null);
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

  return { saved, verify: verifySpreadsheet, reverify: reverifySpreadsheet };
}
