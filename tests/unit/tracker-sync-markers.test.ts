import { afterEach, describe, expect, it, vi } from 'vitest';
import { readTrackerRows } from '@/src/domain/job-offer/tracker-rows';
import {
  paintTrackerSync,
  syncOfferStatusPage,
  syncTooltip,
  syncTrackerPage,
  watchTrackerList,
} from '@/src/infrastructure/platforms/linkedin/tracker-sync-markers';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('tracker sync markers', () => {
  it('shows a cross when the job is missing and a check with the sheet position', () => {
    document.body.innerHTML = rowHtml(
      '4372128087',
      'Sélectionner Software Engineer',
    );
    const rows = readTrackerRows(document);

    paintTrackerSync(rows, [
      {
        url: 'https://www.linkedin.com/jobs/view/4372128087/',
        status: 'found',
        application: {
          sheet: '2026',
          row: 12,
          lastRow: 180,
        },
      },
    ]);

    const marker = document.querySelector('[data-job-tracker-sync]');
    const noteLink = [...document.querySelectorAll('a')].find((anchor) =>
      anchor.textContent?.includes('Ajouter une note'),
    );

    expect(marker?.parentElement).toBe(noteLink?.parentElement);
    expect(marker?.previousElementSibling).toBe(noteLink);
    expect(
      marker?.shadowRoot?.querySelector('button')?.getAttribute('aria-label'),
    ).toBe('2026 - 12/180 lignes');
    expect(syncTooltip({ url: 'x', status: 'missing' })).toBe(
      'Pas encore enregistrée dans le tableur.',
    );
  });

  it('marks both the wide row and the narrow card', () => {
    document.body.innerHTML = `
      <div id="wide">
        <a href="https://www.linkedin.com/jobs/view/4372128087/">Offre</a>
        <button type="button"><span>Ajouter une note</span></button>
      </div>
      <div id="narrow">
        <a href="https://www.linkedin.com/jobs/view/4372128087/">Offre</a>
        <a href="https://www.linkedin.com/jobs-tracker/?stage=applied">
          <span>Ajouter une note</span>
        </a>
      </div>
    `;
    const rows = readTrackerRows(document);

    paintTrackerSync(rows, [
      {
        url: 'https://www.linkedin.com/jobs/view/4372128087/',
        status: 'found',
        application: {
          sheet: '2026',
          row: 12,
          lastRow: 180,
        },
      },
    ]);

    expect(document.querySelectorAll('[data-job-tracker-sync]')).toHaveLength(
      2,
    );
    expect(
      document
        .querySelector('#wide button')
        ?.parentElement?.querySelector('[data-job-tracker-sync]'),
    ).not.toBeNull();
    expect(
      document
        .querySelector('#narrow a span')
        ?.parentElement?.parentElement?.querySelector(
          '[data-job-tracker-sync]',
        ),
    ).not.toBeNull();
  });

  it('asks the sheet once for the visible rows and skips an empty listing', async () => {
    document.body.innerHTML = '<h2>Aucun résultat</h2>';
    const ask = vi.fn(() => Promise.resolve({ status: 'ok', matches: [] }));

    await syncTrackerPage(
      document,
      'https://www.linkedin.com/jobs-tracker/?stage=applied',
      ask,
    );

    expect(ask).not.toHaveBeenCalled();
    expect(document.querySelector('[data-job-tracker-sync]')).toBeNull();
  });

  it('skips saved jobs because those offers were not applied to', async () => {
    document.body.innerHTML = rowHtml(
      '4372128087',
      'Sélectionner Software Engineer',
    );
    const ask = vi.fn(() => Promise.resolve({ status: 'ok', matches: [] }));

    await syncTrackerPage(
      document,
      'https://www.linkedin.com/jobs-tracker/?stage=saved',
      ask,
    );

    expect(ask).not.toHaveBeenCalled();
    expect(document.querySelector('[data-job-tracker-sync]')).toBeNull();
  });

  it('shows an info icon with the sheet problem when the lookup fails', async () => {
    document.body.innerHTML = rowHtml(
      '4372128087',
      'Sélectionner Software Engineer',
    );
    const ask = vi.fn(() =>
      Promise.resolve({
        status: 'unavailable',
        detail: 'Google 500',
      }),
    );

    await syncTrackerPage(
      document,
      'https://www.linkedin.com/jobs-tracker/?stage=applied',
      ask,
    );

    const marker = document.querySelector('[data-job-tracker-sync]');
    const button = marker?.shadowRoot?.querySelector('button');

    expect(button?.getAttribute('aria-label')).toBe(
      'Impossible de lire le tableur. Google 500',
    );
    expect(button?.innerHTML).toContain('M12 16v-4');
    expect(button?.style.getPropertyValue('--jt-color')).toBe('#1d4ed8');
  });

  it('places the sheet tooltip to the right of Statut de la demande', async () => {
    document.body.innerHTML = `
      <h2>Statut de la demande</h2>
      <p>Candidature sur le site de l'entreprise</p>
    `;
    const ask = vi.fn(() =>
      Promise.resolve({
        status: 'ok',
        matches: [
          {
            url: 'https://www.linkedin.com/jobs/view/4475027705/',
            status: 'found',
            application: {
              sheet: '2026',
              row: 12,
              lastRow: 180,
              url: 'https://www.linkedin.com/jobs/view/4475027705/',
              status: 'Envoyée',
              appliedOn: '2026-10-01',
            },
          },
        ],
      }),
    );

    await syncOfferStatusPage(
      document,
      'https://www.linkedin.com/jobs/view/4475027705/',
      ask,
    );

    const marker = document
      .querySelector('h2')
      ?.querySelector('[data-job-offer-sync]');

    expect(ask).toHaveBeenCalledWith([
      'https://www.linkedin.com/jobs/view/4475027705/',
    ]);
    expect(marker?.parentElement).toBe(document.querySelector('h2'));
    expect(marker).toBeInstanceOf(HTMLElement);
    expect(marker instanceof HTMLElement ? marker.style.marginLeft : '').toBe(
      '1rem',
    );
    expect(
      marker?.shadowRoot?.querySelector('button')?.getAttribute('aria-label'),
    ).toBe('2026 - 12/180 lignes');
  });

  it('skips the view tooltip when Statut de la demande is absent', async () => {
    document.body.innerHTML = '<button type="button">Postuler</button>';
    const ask = vi.fn(() => Promise.resolve({ status: 'ok', matches: [] }));

    await syncOfferStatusPage(
      document,
      'https://www.linkedin.com/jobs/view/4475027705/',
      ask,
    );

    expect(ask).not.toHaveBeenCalled();
    expect(document.querySelector('[data-job-offer-sync]')).toBeNull();
  });

  it('ignores the sync marker and still sees a new listing page', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = rowHtml('1', 'Sélectionner Première offre');
    const onChange = vi.fn();
    const stop = watchTrackerList(document, onChange, 200);
    const marker = document.createElement('span');
    marker.setAttribute('data-job-tracker-sync', '');
    document.body.append(marker);
    await vi.advanceTimersByTimeAsync(200);

    expect(onChange).not.toHaveBeenCalled();

    document.body.innerHTML = rowHtml('2', 'Sélectionner Deuxième offre');
    await vi.advanceTimersByTimeAsync(200);

    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });

  it('refreshes when the listing page changes without a new url', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = rowHtml('1', 'Sélectionner Première offre');
    const onChange = vi.fn();
    const stop = watchTrackerList(document, onChange, 200);

    document.body.innerHTML = rowHtml('2', 'Sélectionner Deuxième offre');
    await vi.advanceTimersByTimeAsync(200);

    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });
});

function rowHtml(jobId: string, checkboxLabel: string): string {
  return `
    <div>
      <div role="checkbox" aria-label="${checkboxLabel}"></div>
      <a href="https://www.linkedin.com/jobs/view/${jobId}/">Offre</a>
      <div>
        <a href="https://www.linkedin.com/jobs-tracker/?stage=applied">
          <span>Ajouter une note</span>
        </a>
      </div>
    </div>
  `;
}
