import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ApplicationFooter,
  spreadsheetLookupUrl,
  useSheetLookup,
  visibleSheetLookup,
} from '@/src/presentation/popup/ApplicationFooter';

describe('ApplicationFooter', () => {
  it('says when LinkedIn and the spreadsheet already know the application', () => {
    render(
      <ApplicationFooter
        application={{
          state: 'applied',
          statusLabel: 'Candidature envoyée',
          relativeDate: 'il y a 1 semaine',
        }}
        sheet={{
          status: 'found',
          sheet: '2026',
          row: 164,
          lastRow: 179,
        }}
        appliedOn=""
        onAppliedOnChange={vi.fn()}
        onLink={() => Promise.resolve(null)}
      />,
    );

    expect(
      screen.getByText(
        'Déjà postulé sur LinkedIn : Candidature envoyée (il y a 1 semaine).',
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Déjà enregistrée dans le tableur (2026 - 164/179 lignes).',
      ),
    ).toBeVisible();
    expect(screen.queryByLabelText('Date réelle de candidature')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Lier au tableur' }),
    ).toBeNull();
  });

  it('asks for the real date when LinkedIn sent the application and the sheet has no row', () => {
    const onAppliedOnChange = vi.fn();
    const onLink = vi.fn(() => Promise.resolve(null));

    render(
      <ApplicationFooter
        application={{
          state: 'applied',
          statusLabel: 'Candidature envoyée',
          relativeDate: 'il y a 1 semaine',
        }}
        sheet={{ status: 'missing' }}
        appliedOn=""
        onAppliedOnChange={onAppliedOnChange}
        onLink={onLink}
      />,
    );

    expect(
      screen.getByText('Pas encore enregistrée dans le tableur.'),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText('Date réelle de candidature'), {
      target: { value: '2026-10-15' },
    });

    expect(onAppliedOnChange).toHaveBeenCalledWith('2026-10-15');
    expect(
      screen.getByRole('button', { name: 'Lier au tableur' }),
    ).toBeDisabled();
  });

  it('hides the date and the link button when the offer was not sent', () => {
    render(
      <ApplicationFooter
        application={{
          state: 'not_applied',
          statusLabel: '',
          relativeDate: '',
        }}
        sheet={{ status: 'missing' }}
        appliedOn=""
        onAppliedOnChange={vi.fn()}
        onLink={() => Promise.resolve(null)}
      />,
    );

    expect(
      screen.getByText('Pas de candidature envoyée détectée sur LinkedIn.'),
    ).toBeVisible();
    expect(screen.queryByLabelText('Date réelle de candidature')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Lier au tableur' }),
    ).toBeNull();
    expect(
      screen.queryByText('Pas encore enregistrée dans le tableur.'),
    ).toBeNull();
    expect(screen.queryByText('Lecture du tableur…')).toBeNull();
  });

  it('does not read the spreadsheet when no application was sent', async () => {
    const sendMessage = vi.fn();
    vi.stubGlobal('browser', { runtime: { sendMessage } });
    const url = spreadsheetLookupUrl(
      { state: 'not_applied', statusLabel: '', relativeDate: '' },
      'https://www.linkedin.com/jobs/view/1/',
    );
    const { result } = renderHook(() => useSheetLookup(url));

    await Promise.resolve();

    expect(url).toBe('');
    expect(result.current.sheet.status).toBe('idle');
    expect(sendMessage).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('drops a saved spreadsheet row as soon as the workbook is disconnected', () => {
    expect(
      visibleSheetLookup(true, false, {
        status: 'found',
        sheet: '2026',
        row: 12,
        lastRow: 40,
      }),
    ).toEqual({ status: 'not_configured' });
  });

  it('keeps the LinkedIn status and says the workbook is disconnected', () => {
    render(
      <ApplicationFooter
        application={{
          state: 'applied',
          statusLabel: 'Candidature envoyée',
          relativeDate: 'il y a 3 semaines',
        }}
        sheet={{ status: 'not_configured' }}
        appliedOn=""
        onAppliedOnChange={vi.fn()}
        onLink={() => Promise.resolve(null)}
      />,
    );

    expect(
      screen.getByText(
        'Déjà postulé sur LinkedIn : Candidature envoyée (il y a 3 semaines).',
      ),
    ).toBeVisible();
    expect(screen.getByText('Tableur non connecté.')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Lier au tableur' }),
    ).toBeNull();
  });

  it('links a sent application once the date is filled', () => {
    const onLink = vi.fn(() => Promise.resolve(null));

    render(
      <ApplicationFooter
        application={{
          state: 'applied',
          statusLabel: 'Candidature envoyée',
          relativeDate: 'il y a 1 mois',
        }}
        sheet={{ status: 'missing' }}
        appliedOn="2026-09-15"
        onAppliedOnChange={vi.fn()}
        onLink={onLink}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lier au tableur' }));

    expect(onLink).toHaveBeenCalledOnce();
  });

  it('does not claim an application was sent when LinkedIn only shows Postuler', () => {
    render(
      <ApplicationFooter
        application={{
          state: 'not_applied',
          statusLabel: '',
          relativeDate: '',
        }}
        sheet={{ status: 'missing' }}
        appliedOn=""
        onAppliedOnChange={vi.fn()}
        onLink={() => Promise.resolve(null)}
      />,
    );

    expect(
      screen.getByText('Pas de candidature envoyée détectée sur LinkedIn.'),
    ).toBeVisible();
    expect(screen.queryByLabelText('Date réelle de candidature')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Lier au tableur' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: "Détail de l'erreur" }),
    ).toBeNull();
  });

  it('shows the spreadsheet error in a popover', () => {
    render(
      <ApplicationFooter
        application={{
          state: 'applied',
          statusLabel: 'Candidature envoyée',
          relativeDate: 'il y a 4 mois',
        }}
        sheet={{ status: 'unavailable', detail: '400' }}
        appliedOn=""
        onAppliedOnChange={vi.fn()}
        onLink={() => Promise.resolve(null)}
      />,
    );

    expect(screen.getByText('Impossible de lire le tableur.')).toBeVisible();
    expect(
      screen.getAllByRole('button', { name: "Détail de l'erreur" }),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: "Détail de l'erreur" }));

    expect(screen.getByText('400').tagName).toBe('CODE');
  });

  it('shows the LinkedIn error in a popover only when one is provided', () => {
    render(
      <ApplicationFooter
        application={null}
        linkedinError="Impossible de lire l'offre sur cette page."
        sheet={{ status: 'idle' }}
        appliedOn=""
        onAppliedOnChange={vi.fn()}
        onLink={() => Promise.resolve(null)}
      />,
    );

    expect(screen.getByText('Statut LinkedIn indisponible.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: "Détail de l'erreur" }));

    expect(
      screen.getByText("Impossible de lire l'offre sur cette page.").tagName,
    ).toBe('CODE');
  });

  it('spins and stays disabled while the row is sent to the sheet', async () => {
    let finish: (error: string | null) => void = () => undefined;
    const onLink = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          finish = resolve;
        }),
    );

    render(
      <ApplicationFooter
        application={{
          state: 'applied',
          statusLabel: 'Candidature envoyée',
          relativeDate: 'il y a 1 mois',
        }}
        sheet={{ status: 'missing' }}
        appliedOn="2026-09-15"
        onAppliedOnChange={vi.fn()}
        onLink={onLink}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lier au tableur' }));

    const button = screen.getByRole('button', { name: 'Lier au tableur' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('.animate-spin')).not.toBeNull();

    finish("L'onglet 2026 n'existe pas. Aucune ligne n'a été ajoutée.");

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "L'onglet 2026 n'existe pas. Aucune ligne n'a été ajoutée.",
    );
    expect(
      screen.getByRole('button', { name: 'Lier au tableur' }),
    ).toBeEnabled();
  });
});
