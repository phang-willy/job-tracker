import { useEffect, useState } from 'react';
import { SettingsPanel } from '@/src/presentation/options/SettingsPanel';
import { useSpreadsheetSettings } from '@/src/presentation/options/use-spreadsheet-settings';
import {
  describeActiveTab,
  type ActiveTabSummary,
} from '@/src/presentation/shared/active-tab';
import { cn } from '@/src/presentation/shared/cn';

type PopupTab = 'application' | 'settings';

const tabs = [
  { id: 'application', label: 'Candidature' },
  { id: 'settings', label: 'Paramètres' },
] as const satisfies ReadonlyArray<{ id: PopupTab; label: string }>;

export function PopupApp() {
  const [tab, setTab] = useState<PopupTab>('application');
  const [summary, setSummary] = useState<ActiveTabSummary | null>(null);
  const settings = useSpreadsheetSettings();

  useEffect(() => {
    let cancelled = false;

    void browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (!cancelled) {
          setSummary(describeActiveTab(tabs[0]));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(describeActiveTab(undefined));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex w-145 min-h-72 flex-col bg-white p-4 text-sm text-neutral-900">
      <h1 className="text-base font-semibold">Job Tracker</h1>
      <div
        className="mt-4 flex gap-2 border-b border-neutral-200"
        role="tablist"
      >
        {tabs.map((item) => {
          const selected = tab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`popup-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`popup-panel-${item.id}`}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 font-medium hover:cursor-pointer hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2',
                selected
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500',
              )}
              onClick={() => {
                setTab(item.id);
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {tab === 'application' ? (
        <section
          className="pt-4"
          role="tabpanel"
          id="popup-panel-application"
          aria-labelledby="popup-tab-application"
        >
          <h2 className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
            Onglet actif
          </h2>
          <p className="mt-1 font-medium">
            {summary?.title ?? 'Lecture de l’onglet…'}
          </p>
          {summary?.location ? (
            <p className="mt-0.5 truncate text-neutral-600">
              {summary.location}
            </p>
          ) : null}
        </section>
      ) : (
        <div
          className="pt-4"
          role="tabpanel"
          id="popup-panel-settings"
          aria-labelledby="popup-tab-settings"
        >
          <SettingsPanel
            saved={settings.saved}
            onVerify={settings.verify}
            onReverify={settings.reverify}
          />
        </div>
      )}
    </main>
  );
}
