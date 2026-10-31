import { useRef, useState } from 'react';
import { estimateAppliedOn } from '@/src/domain/job-offer/applied-on';
import { isLinkedInUrl } from '@/src/domain/job-offer/platform';
import type { SiteApplicationStatus } from '@/src/domain/job-offer/application-status';
import { SettingsPanel } from '@/src/presentation/options/SettingsPanel';
import { useSpreadsheetSettings } from '@/src/presentation/options/use-spreadsheet-settings';
import {
  ApplicationFooter,
  spreadsheetLookupUrl,
  useSheetLookup,
  visibleSheetLookup,
  type SheetLookup,
} from '@/src/presentation/popup/ApplicationFooter';
import { ApplicationForm } from '@/src/presentation/popup/ApplicationForm';
import type { ApplicationFormValues } from '@/src/presentation/popup/application-form-schema';
import {
  hasRecognizedJobLink,
  type ApplicationView,
} from '@/src/presentation/popup/application-view';
import {
  linkApplication,
  linkFailureMessage,
} from '@/src/presentation/popup/link-application';
import { useActiveJobOffer } from '@/src/presentation/popup/use-active-job-offer';
import { cn } from '@/src/presentation/shared/cn';

type PopupTab = 'application' | 'settings';

const tabs = [
  { id: 'application', label: 'Candidature' },
  { id: 'settings', label: 'Paramètres' },
] as const satisfies ReadonlyArray<{ id: PopupTab; label: string }>;

export function PopupApp() {
  const [tab, setTab] = useState<PopupTab>('application');
  const readDraft = useRef<(() => ApplicationFormValues) | null>(null);
  const settings = useSpreadsheetSettings();
  const view = useActiveJobOffer();
  const connected = settings.ready && settings.saved !== null;
  const applicationOpen = connected && hasRecognizedJobLink(view);
  const activeTab: PopupTab =
    applicationOpen && tab === 'application' ? 'application' : 'settings';
  const sheetLookup = useSheetLookup(
    connected
      ? spreadsheetLookupUrl(view.application, view.offer?.url ?? '')
      : '',
  );
  const sheet = visibleSheetLookup(
    settings.ready,
    connected,
    sheetLookup.sheet,
  );
  const appliedOn = useSuggestedAppliedOn(
    view.application,
    sheet,
    view.offer?.url ?? '',
  );

  return (
    <>
      <header className=" bg-white text-sm text-neutral-900 top-0 left-0 right-0 sticky z-10 border-b border-neutral-200">
        <div className="flex flex-col px-4 py-2">
          <h1 className="text-base font-semibold">Job Tracker</h1>
          <div className="mt-4 flex gap-2" role="tablist">
            {tabs.map((item) => {
              const locked = item.id === 'application' && !applicationOpen;
              const selected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`popup-tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls={`popup-panel-${item.id}`}
                  aria-disabled={locked}
                  disabled={locked}
                  className={cn(
                    '-mb-px border-b-2 px-3 py-2 font-medium hover:cursor-pointer hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
                    selected
                      ? 'border-neutral-900 text-neutral-900'
                      : 'border-transparent text-neutral-500',
                  )}
                  onClick={() => {
                    if (!locked) {
                      setTab(item.id);
                    }
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>
      <main className="bg-white text-sm text-neutral-900">
        <div className="px-4 py-2 flex flex-col">
          {!settings.ready ? (
            <p>Lecture des paramètres…</p>
          ) : connected && view.status === 'loading' ? (
            <p>Lecture de l'offre…</p>
          ) : activeTab === 'application' ? (
            <section
              className="min-w-0"
              role="tabpanel"
              id="popup-panel-application"
              aria-labelledby="popup-tab-application"
            >
              <ActiveJobOfferPanel view={view} valuesRef={readDraft} />
            </section>
          ) : (
            <div
              role="tabpanel"
              id="popup-panel-settings"
              aria-labelledby="popup-tab-settings"
            >
              <SettingsPanel
                saved={settings.saved}
                onVerify={settings.verify}
                onReverify={settings.reverify}
                onDesync={settings.desync}
              />
            </div>
          )}
        </div>
      </main>
      {activeTab === 'application' ? (
        <ApplicationFooter
          key={view.offer?.url ?? ''}
          application={view.application}
          linkedinError={view.status === 'error' ? view.notice : null}
          sheet={sheet}
          appliedOn={appliedOn.value}
          onAppliedOnChange={appliedOn.setValue}
          onLink={() =>
            linkCurrentApplication(
              readDraft.current,
              appliedOn.value,
              sheetLookup.reload,
            )
          }
        />
      ) : null}
    </>
  );
}

function useSuggestedAppliedOn(
  application: SiteApplicationStatus | null,
  sheet: SheetLookup,
  url: string,
): { value: string; setValue: (value: string) => void } {
  const suggested =
    application?.state === 'applied' && sheet.status === 'missing'
      ? estimateAppliedOn(application.relativeDate, new Date())
      : '';
  const source = `${url}|${application?.relativeDate ?? ''}|${sheet.status}`;
  const [trackedSource, setTrackedSource] = useState(source);
  const [value, setValue] = useState(suggested);

  if (source !== trackedSource) {
    setTrackedSource(source);
    setValue(suggested);
  }

  return { value, setValue };
}

async function linkCurrentApplication(
  readDraft: (() => ApplicationFormValues) | null,
  appliedOn: string,
  reload: () => void,
): Promise<string | null> {
  const draft = readDraft?.() ?? null;

  if (draft == null) {
    return "La candidature n'est pas prête.";
  }

  const result = await linkApplication({
    ...draft,
    appliedOn: appliedOn === '' ? localIsoDate(new Date()) : appliedOn,
  });

  if (result.status === 'found') {
    reload();
    await reloadLinkedInSourceTab();
    return null;
  }

  return linkFailureMessage(result);
}

export async function reloadLinkedInSourceTab(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const tab = tabs[0];

    if (tab?.id == null || !isLinkedInUrl(tab.url ?? '')) {
      return;
    }

    await browser.tabs.reload(tab.id);
  } catch {
    return;
  }
}

function localIsoDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function ActiveJobOfferPanel({
  view,
  valuesRef,
}: {
  view: ApplicationView;
  valuesRef: { current: (() => ApplicationFormValues) | null };
}) {
  const formKey =
    view.offer === null
      ? view.status
      : [
          view.offer.url,
          view.offer.company,
          view.offer.title,
          view.offer.city,
          view.offer.region,
          view.offer.country,
          view.offer.monthlySalary,
          view.offer.annualSalary,
          view.offer.contractType,
        ].join('|');

  return (
    <ApplicationForm
      key={formKey}
      status={view.status}
      offer={view.offer}
      notice={view.notice}
      valuesRef={valuesRef}
    />
  );
}
