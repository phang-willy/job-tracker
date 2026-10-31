import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { LuCircleCheck, LuCircleHelp, LuCircleX, LuInfo } from 'react-icons/lu';
import type {
  SavedSpreadsheetSettings,
  ValidateSpreadsheetResult,
} from '@/src/application/dto/spreadsheet-messages';
import type { YearCheck } from '@/src/domain/spreadsheet/structure';
import { z } from '@/src/infrastructure/zod';

const formSchema = z.object({
  spreadsheetUrl: z.string().trim().min(1, "Colle l'URL du classeur."),
});

type FormValues = z.infer<typeof formSchema>;

export type SettingsCheckResult =
  | ValidateSpreadsheetResult
  | { status: 'consent_window' }
  | { status: 'unauthenticated'; detail: string };

export function SettingsPanel({
  saved,
  onVerify,
  onReverify,
  onDesync,
}: {
  saved: SavedSpreadsheetSettings | null;
  onVerify: (url: string) => Promise<SettingsCheckResult>;
  onReverify: (url: string) => Promise<SettingsCheckResult>;
  onDesync: () => Promise<void>;
}) {
  const [result, setResult] = useState<SettingsCheckResult | null>(null);
  const [pending, setPending] = useState<
    'verify' | 'reverify' | 'desync' | null
  >(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { spreadsheetUrl: '' },
  });

  useEffect(() => {
    if (saved !== null) {
      form.reset({ spreadsheetUrl: saved.url });
    }
  }, [saved, form]);

  const shownResult =
    saved !== null && result?.status === 'consent_window' ? null : result;

  function check(url: string, mode: 'verify' | 'reverify'): Promise<void> {
    setPending(mode);

    const request = mode === 'verify' ? onVerify(url) : onReverify(url);

    return request
      .then((next) => {
        setResult(next);
      })
      .catch(() => {
        setResult({ status: 'unavailable' });
      })
      .finally(() => {
        setPending(null);
      });
  }

  function desync(): Promise<void> {
    setPending('desync');

    return onDesync()
      .then(() => {
        setResult(null);
        form.reset({ spreadsheetUrl: '' });
      })
      .catch(() => {
        setResult({ status: 'unavailable' });
      })
      .finally(() => {
        setPending(null);
      });
  }

  return (
    <section>
      <h2 className="text-base font-semibold">Paramètres</h2>
      <form
        className="mt-3"
        onSubmit={(event) => {
          if (saved !== null) {
            event.preventDefault();
            return;
          }

          void form.handleSubmit((values) =>
            check(values.spreadsheetUrl, 'verify'),
          )(event);
        }}
      >
        <label className="block font-medium" htmlFor="spreadsheet-url">
          URL du classeur
        </label>
        <input
          id="spreadsheet-url"
          type="url"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2"
          placeholder="https://docs.google.com/spreadsheets/d/…"
          {...form.register('spreadsheetUrl')}
        />
        {form.formState.errors.spreadsheetUrl ? (
          <p className="mt-1 text-red-700">
            {form.formState.errors.spreadsheetUrl.message}
          </p>
        ) : null}
        <div className="mt-3 flex items-center justify-between">
          {saved === null ? (
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-3 py-2 font-medium text-white hover:cursor-pointer hover:bg-neutral-800 focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:outline-none disabled:opacity-60"
              disabled={pending !== null}
            >
              {pending === 'verify' ? 'Vérification…' : 'Vérifier'}
            </button>
          ) : (
            <button
              type="button"
              className="rounded-md bg-neutral-900 px-3 py-2 font-medium text-white hover:cursor-pointer hover:bg-neutral-800 focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:outline-none disabled:opacity-60"
              disabled={pending !== null}
              onClick={() => {
                void desync();
              }}
            >
              {pending === 'desync' ? 'Désynchronisation…' : 'Désynchroniser'}
            </button>
          )}
          {saved !== null ? (
            <button
              type="button"
              className="rounded-md border border-neutral-300 px-3 py-2 font-medium text-neutral-900 hover:cursor-pointer hover:bg-neutral-200 focus:bg-neutral-200 focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:outline-none disabled:opacity-60"
              disabled={pending !== null}
              onClick={() => {
                void form.handleSubmit((values) =>
                  check(values.spreadsheetUrl, 'reverify'),
                )();
              }}
            >
              {pending === 'reverify' ? 'Revérification…' : 'Revérifier'}
            </button>
          ) : null}
        </div>
      </form>
      <div className="mt-4" aria-live="polite">
        {shownResult === null && saved !== null ? (
          <CompatibleSummary settings={saved} />
        ) : null}
        {shownResult !== null ? <CheckResult result={shownResult} /> : null}
      </div>
    </section>
  );
}

export function CheckResult({ result }: { result: SettingsCheckResult }) {
  if (result.status === 'compatible') {
    return <CompatibleSummary settings={result} />;
  }

  if (result.status === 'incompatible') {
    return (
      <SpreadsheetSummary
        title={result.title}
        years={result.years}
        writeAccess={null}
      />
    );
  }

  if (result.status === 'consent_window') {
    return (
      <p>
        Une fenêtre de connexion est ouverte. Termine l'autorisation Google
        dedans.
      </p>
    );
  }

  if (result.status === 'unauthenticated' && 'detail' in result) {
    return <p>{result.detail}</p>;
  }

  if (result.status === 'access_denied' && result.notFound === true) {
    return <p>Ce classeur est introuvable.</p>;
  }

  if (
    result.status === 'access_denied' &&
    result.cause === 'sheets_api_disabled'
  ) {
    return (
      <p>
        Active l'API Google Sheets dans le projet Google Cloud, puis réessaie.
      </p>
    );
  }

  if (result.status === 'unavailable') {
    const http =
      result.detail != null && /^\d{3}$/.test(result.detail)
        ? ` (HTTP ${result.detail})`
        : '';

    return (
      <p>
        Erreur réseau. Google Sheets est temporairement inaccessible.
        {http}
      </p>
    );
  }

  return <p>{describeStatus(result.status)}</p>;
}

function CompatibleSummary({
  settings,
}: {
  settings: Pick<SavedSpreadsheetSettings, 'title' | 'writeAccess' | 'years'>;
}) {
  return (
    <SpreadsheetSummary
      title={settings.title}
      years={settings.years}
      writeAccess={settings.writeAccess}
    />
  );
}

function SpreadsheetSummary({
  title,
  years,
  writeAccess,
}: {
  title: string;
  years: readonly YearCheck[];
  writeAccess: SavedSpreadsheetSettings['writeAccess'] | null;
}) {
  const heading = title === '' ? 'Classeur' : `Classeur « ${title} »`;
  const failed = structureFailed(years);

  return (
    <div>
      <h3 className="font-medium">{heading}</h3>
      <dl className="mt-2 space-y-1">
        <CompatibilityRow failed={failed} years={years} />
        <StatusRow label="Accessibilité" tone="ok" iconLabel="OK" />
        {writeAccess == null ? null : (
          <StatusRow
            label="Écriture"
            tone={writeAccessTone(writeAccess)}
            iconLabel={writeAccessLabel(writeAccess)}
            detail={
              writeAccess === 'unverified'
                ? "Lecture confirmée — droits d'écriture non vérifiés"
                : undefined
            }
          />
        )}
      </dl>
    </div>
  );
}

function CompatibilityRow({
  failed,
  years,
}: {
  failed: boolean;
  years: readonly YearCheck[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={failed ? 'text-red-800' : undefined}>Compatibilité</dt>
      <dd>
        {failed ? (
          <span
            className="relative inline-flex"
            onMouseEnter={() => {
              setOpen(true);
            }}
            onMouseLeave={() => {
              setOpen(false);
            }}
            onFocus={() => {
              setOpen(true);
            }}
            onBlur={() => {
              setOpen(false);
            }}
          >
            <button
              type="button"
              className="text-red-800"
              aria-expanded={open}
              aria-label="Détail des années"
            >
              <LuInfo className="size-4" aria-hidden />
            </button>
            {open ? (
              <ul
                className="absolute top-full right-0 z-10 mt-1 min-w-28 rounded-md border border-neutral-200 bg-white p-2 text-neutral-900 shadow-sm"
                role="tooltip"
              >
                {years.map((year) => (
                  <li
                    key={year.year}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>{year.year}</span>
                    <YearIcon status={year.status} />
                  </li>
                ))}
              </ul>
            ) : null}
          </span>
        ) : (
          <StatusIcon tone="ok" label="OK" />
        )}
      </dd>
    </div>
  );
}

function structureFailed(years: readonly YearCheck[]): boolean {
  return years.some(
    (year, index) =>
      year.status === 'invalid' || (index === 1 && year.status === 'missing'),
  );
}

function YearIcon({ status }: { status: YearCheck['status'] }) {
  switch (status) {
    case 'ok':
      return <StatusIcon tone="ok" label="OK" />;
    case 'invalid':
      return <StatusIcon tone="bad" label="Erreur" />;
    case 'missing':
      return <StatusIcon tone="pending" label="Inconnu" />;
  }
}

function StatusRow({
  label,
  tone,
  iconLabel,
  detail,
}: {
  label: string;
  tone: 'ok' | 'pending' | 'bad';
  iconLabel: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt>{label}</dt>
      <dd className="flex items-center gap-2 text-right">
        {detail == null ? null : (
          <span className={toneClass(tone)}>{detail}</span>
        )}
        <StatusIcon tone={tone} label={iconLabel} />
      </dd>
    </div>
  );
}

function StatusIcon({
  tone,
  label,
}: {
  tone: 'ok' | 'pending' | 'bad';
  label: string;
}) {
  const className = `size-4 ${toneClass(tone)}`;

  switch (tone) {
    case 'ok':
      return (
        <LuCircleCheck className={className} role="img" aria-label={label} />
      );
    case 'pending':
      return (
        <LuCircleHelp className={className} role="img" aria-label={label} />
      );
    case 'bad':
      return <LuCircleX className={className} role="img" aria-label={label} />;
  }
}

function toneClass(tone: 'ok' | 'pending' | 'bad'): string {
  switch (tone) {
    case 'ok':
      return 'text-emerald-800';
    case 'pending':
      return 'text-amber-800';
    case 'bad':
      return 'text-red-800';
  }
}

function writeAccessLabel(
  writeAccess: SavedSpreadsheetSettings['writeAccess'],
): string {
  switch (writeAccess) {
    case 'verified':
      return 'OK';
    case 'denied':
      return 'Lecture seule';
    case 'unverified':
      return 'Non vérifiée';
    default:
      return writeAccess;
  }
}

function writeAccessTone(
  writeAccess: SavedSpreadsheetSettings['writeAccess'],
): 'ok' | 'pending' | 'bad' {
  switch (writeAccess) {
    case 'verified':
      return 'ok';
    case 'denied':
      return 'bad';
    case 'unverified':
      return 'pending';
    default:
      return 'bad';
  }
}

function describeStatus(
  status: Exclude<
    SettingsCheckResult['status'],
    'compatible' | 'incompatible' | 'consent_window'
  >,
): string {
  switch (status) {
    case 'invalid_url':
      return "Cette URL n'est pas un classeur Google Sheets.";
    case 'access_denied':
      return 'Accès refusé.';
    case 'unauthenticated':
      return 'Connexion Google requise.';
    case 'oauth_not_configured':
      return "La connexion Google n'est pas configurée.";
    case 'unavailable':
      return 'Erreur réseau. Google Sheets est temporairement inaccessible.';
  }
}
