import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { logVerify } from '@/src/infrastructure/logging/verify-log';
import { CheckResult } from '@/src/presentation/options/SettingsPanel';
import { runSpreadsheetCheck } from '@/src/presentation/options/spreadsheet-settings-client';
import type { SettingsCheckResult } from '@/src/presentation/options/SettingsPanel';
import './style.css';

let checkInFlight: Promise<SettingsCheckResult> | null = null;

function SheetCheckApp() {
  const [result, setResult] = useState<SettingsCheckResult | null>(null);
  const url = new URLSearchParams(window.location.search).get('url') ?? '';

  useEffect(() => {
    let cancelled = false;
    checkInFlight ??= runSpreadsheetCheck(url, true);

    void checkInFlight.then((next) => {
      logVerify('sheet-check.result', next);

      if (next.status === 'compatible' || next.status === 'incompatible') {
        void closeThisWindow();
        return;
      }

      if (cancelled) {
        return;
      }

      setResult(next);
      void focusThisWindow();
    });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <main className="min-h-screen bg-white p-4 text-sm text-neutral-900">
      <h1 className="text-base font-semibold">Vérification du classeur</h1>
      <div className="mt-4" aria-live="polite">
        {result === null ? (
          <p>Vérification…</p>
        ) : (
          <CheckResult result={result} />
        )}
      </div>
    </main>
  );
}

async function closeThisWindow(): Promise<void> {
  const current = await browser.windows.getCurrent();

  if (current.id != null) {
    await browser.windows.remove(current.id);
  }
}

async function focusThisWindow(): Promise<void> {
  const current = await browser.windows.getCurrent();

  if (current.id != null) {
    await browser.windows.update(current.id, { focused: true });
  }
}

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Missing #root');
}

createRoot(rootElement).render(<SheetCheckApp />);
