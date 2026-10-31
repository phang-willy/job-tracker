import { Info, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { existingApplicationResultSchema } from '@/src/application/dto/spreadsheet-messages';
import type { SiteApplicationStatus } from '@/src/domain/job-offer/application-status';
import { sheetPositionLabel } from '@/src/domain/spreadsheet/applications';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/src/presentation/components/ui/popover';

export type SheetLookup =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; sheet: string; row: number; lastRow: number }
  | { status: 'missing' }
  | { status: 'not_configured' }
  | { status: 'unavailable'; detail?: string };

export function ApplicationFooter({
  application,
  linkedinError = null,
  sheet,
  appliedOn,
  onAppliedOnChange,
  onLink,
}: {
  application: SiteApplicationStatus | null;
  linkedinError?: string | null;
  sheet: SheetLookup;
  appliedOn: string;
  onAppliedOnChange: (value: string) => void;
  onLink: () => Promise<string | null>;
}) {
  const linkingRef = useRef(false);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const needsDate =
    application?.state === 'applied' && sheet.status === 'missing';
  const linkedin = linkedinLabel(application, linkedinError);
  const spreadsheet = sheetLabel(sheet);

  async function submitLink(): Promise<void> {
    if (linkingRef.current) {
      return;
    }

    linkingRef.current = true;
    setLinking(true);
    setLinkError(null);

    try {
      const error = await onLink();

      if (error != null && error !== '') {
        setLinkError(error);
      }
    } catch (error: unknown) {
      setLinkError(error instanceof Error ? error.message : String(error));
    } finally {
      linkingRef.current = false;
      setLinking(false);
    }
  }

  return (
    <footer className="sticky right-0 bottom-0 left-0 z-10 border-t border-neutral-200 bg-white text-sm text-neutral-900">
      <div className="flex flex-col gap-2 px-4 py-2">
        <StatusLine label={linkedin.label} error={linkedin.error} />
        {application?.state === 'not_applied' ? null : (
          <StatusLine label={spreadsheet.label} error={spreadsheet.error} />
        )}
        {needsDate ? (
          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-1" htmlFor="applied-on">
              Date réelle de candidature
              <input
                id="applied-on"
                type="date"
                value={appliedOn}
                disabled={linking}
                className="h-9 rounded-md border border-neutral-300 px-3 disabled:opacity-60"
                onChange={(event) => {
                  onAppliedOnChange(event.target.value);
                }}
              />
            </label>
            <p className="text-xs text-neutral-600">
              LinkedIn indique une candidature envoyée, absente du tableur.
              Cette date sert à placer la ligne dans l'ordre de la colonne
              "Postulé le".
            </p>
          </div>
        ) : null}
        {needsDate ? (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 self-start rounded-md bg-neutral-900 px-3 font-medium text-white hover:cursor-pointer hover:bg-neutral-800 focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-neutral-900"
            aria-busy={linking}
            disabled={linking || appliedOn === ''}
            onClick={() => {
              void submitLink();
            }}
          >
            {linking ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            Lier au tableur
          </button>
        ) : null}
        {linkError == null ? null : (
          <p role="alert" className="text-red-700">
            {linkError}
          </p>
        )}
      </div>
    </footer>
  );
}

export function visibleSheetLookup(
  settingsReady: boolean,
  connected: boolean,
  lookup: SheetLookup,
): SheetLookup {
  if (!settingsReady) {
    return { status: 'loading' };
  }

  if (!connected) {
    return { status: 'not_configured' };
  }

  return lookup;
}

export function spreadsheetLookupUrl(
  application: SiteApplicationStatus | null,
  url: string,
): string {
  if (application?.state === 'not_applied') {
    return '';
  }

  return url;
}

export function useSheetLookup(url: string): {
  sheet: SheetLookup;
  reload: () => void;
} {
  const [trackedUrl, setTrackedUrl] = useState(url);
  const [reloadKey, setReloadKey] = useState(0);
  const [lookup, setLookup] = useState<SheetLookup>(
    url === '' ? { status: 'idle' } : { status: 'loading' },
  );

  if (url !== trackedUrl) {
    setTrackedUrl(url);
    setLookup(url === '' ? { status: 'idle' } : { status: 'loading' });
  }

  useEffect(() => {
    if (url === '') {
      return;
    }

    let cancelled = false;

    void findExistingApplication(url)
      .then((next) => {
        if (!cancelled) {
          setLookup(next);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLookup({
            status: 'unavailable',
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url, reloadKey]);

  return {
    sheet: lookup,
    reload: () => {
      setLookup(url === '' ? { status: 'idle' } : { status: 'loading' });
      setReloadKey((key) => key + 1);
    },
  };
}

export async function findExistingApplication(
  url: string,
): Promise<SheetLookup> {
  const response: unknown = await browser.runtime.sendMessage({
    type: 'find-existing-application',
    url,
  });
  const parsed = existingApplicationResultSchema.safeParse(response);

  if (!parsed.success) {
    return { status: 'unavailable' };
  }

  if (parsed.data.status === 'found') {
    return {
      status: 'found',
      sheet: parsed.data.application.sheet,
      row: parsed.data.application.row,
      lastRow: parsed.data.application.lastRow,
    };
  }

  if (
    parsed.data.status === 'missing' ||
    parsed.data.status === 'not_configured'
  ) {
    return { status: parsed.data.status };
  }

  if (parsed.data.status === 'unavailable') {
    return parsed.data.detail == null
      ? { status: 'unavailable' }
      : { status: 'unavailable', detail: parsed.data.detail };
  }

  return { status: 'unavailable', detail: parsed.data.status };
}

function linkedinLabel(
  application: SiteApplicationStatus | null,
  error: string | null,
): StatusCopy {
  if (application === null) {
    return { label: 'Statut LinkedIn indisponible.', error };
  }

  if (application.state === 'applied') {
    const when =
      application.relativeDate === '' ? '' : ` (${application.relativeDate})`;

    return {
      label: `Déjà postulé sur LinkedIn : ${application.statusLabel}${when}.`,
      error: null,
    };
  }

  if (application.state === 'not_applied') {
    return {
      label: 'Pas de candidature envoyée détectée sur LinkedIn.',
      error: null,
    };
  }

  return { label: 'Statut LinkedIn incertain.', error: null };
}

function sheetLabel(sheet: SheetLookup): StatusCopy {
  if (sheet.status === 'loading') {
    return { label: 'Lecture du tableur…', error: null };
  }

  if (sheet.status === 'found') {
    return {
      label: `Déjà enregistrée dans le tableur (${sheetPositionLabel(sheet.sheet, sheet.row, sheet.lastRow)}).`,
      error: null,
    };
  }

  if (sheet.status === 'missing') {
    return { label: 'Pas encore enregistrée dans le tableur.', error: null };
  }

  if (sheet.status === 'not_configured') {
    return { label: 'Tableur non connecté.', error: null };
  }

  if (sheet.status === 'idle') {
    return { label: 'Tableur non consulté.', error: null };
  }

  const detail = sheet.detail?.trim() ?? '';

  return {
    label: 'Impossible de lire le tableur.',
    error: detail === '' ? JSON.stringify(sheet) : detail,
  };
}

type StatusCopy = {
  label: string;
  error: string | null;
};

function StatusLine({ label, error }: StatusCopy) {
  return (
    <p className="flex items-center gap-2">
      <span>{label}</span>
      {error === null ? null : <ErrorInfo error={error} />}
    </p>
  );
}

function ErrorInfo({ error }: { error: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Détail de l'erreur"
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Info className="size-3" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <code className="block text-xs break-all whitespace-pre-wrap text-neutral-900">
          {error}
        </code>
      </PopoverContent>
    </Popover>
  );
}
