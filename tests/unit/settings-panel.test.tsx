import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from '@/src/presentation/options/SettingsPanel';

describe('SettingsPanel', () => {
  it('shows that the pasted address is not a Google spreadsheet', async () => {
    const user = userEvent.setup();

    render(
      <SettingsPanel
        saved={null}
        onVerify={() => Promise.resolve({ status: 'invalid_url' })}
        onReverify={() => Promise.resolve({ status: 'invalid_url' })}
      />,
    );

    await user.type(
      screen.getByLabelText('URL du classeur'),
      'https://example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Vérifier' }));

    expect(
      await screen.findByText('Cette URL n’est pas un classeur Google Sheets.'),
    ).toBeVisible();
  });

  it('shows that read and write access are both ok', async () => {
    const onVerify = vi.fn().mockResolvedValue({
      status: 'compatible',
      spreadsheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd',
      url: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/edit',
      title: 'Candidatures',
      annualSheets: ['2026'],
      writeAccess: 'verified',
      years: [],
    });
    const user = userEvent.setup();

    render(
      <SettingsPanel
        saved={null}
        onVerify={onVerify}
        onReverify={() => Promise.resolve({ status: 'unavailable' })}
      />,
    );

    await user.type(
      screen.getByLabelText('URL du classeur'),
      'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/edit',
    );
    await user.click(screen.getByRole('button', { name: 'Vérifier' }));

    expect(await screen.findAllByRole('img', { name: 'OK' })).toHaveLength(3);
    expect(screen.getByText('Compatibilité')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Détail des années' }),
    ).toBeNull();
  });

  it('shows a red compatibility detail when a nearby year fails', async () => {
    const user = userEvent.setup();

    render(
      <SettingsPanel
        saved={null}
        onVerify={() =>
          Promise.resolve({
            status: 'incompatible',
            spreadsheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd',
            title: 'Candidatures',
            problems: [
              {
                code: 'header_mismatch',
                sheet: '2025',
                column: 'A',
                expected: 'Société',
                actual: 'Company',
              },
            ],
            years: [
              { year: '2025', status: 'invalid' },
              { year: '2026', status: 'ok' },
              { year: '2027', status: 'missing' },
            ],
          })
        }
        onReverify={() => Promise.resolve({ status: 'unavailable' })}
      />,
    );

    await user.type(
      screen.getByLabelText('URL du classeur'),
      'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/edit',
    );
    await user.click(screen.getByRole('button', { name: 'Vérifier' }));

    const info = await screen.findByRole('button', {
      name: 'Détail des années',
    });
    expect(info).toHaveClass('text-red-800');
    expect(screen.queryByRole('img', { name: 'Erreur' })).toBeNull();
    await user.hover(info);
    expect(screen.getByText('2025')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Erreur' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Inconnu' })).toBeVisible();
  });

  it('rechecks the saved spreadsheet without starting a new verification', async () => {
    const onVerify = vi.fn();
    const onReverify = vi.fn().mockResolvedValue({
      status: 'compatible',
      spreadsheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd',
      url: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/edit',
      title: 'Candidatures',
      annualSheets: ['2026'],
      writeAccess: 'denied',
      years: [
        { year: '2025', status: 'ok' },
        { year: '2026', status: 'ok' },
        { year: '2027', status: 'missing' },
      ],
    });
    const user = userEvent.setup();

    render(
      <SettingsPanel
        saved={{
          spreadsheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd',
          url: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/edit',
          title: 'Candidatures',
          annualSheets: ['2026'],
          writeAccess: 'verified',
          years: [
            { year: '2025', status: 'ok' },
            { year: '2026', status: 'ok' },
            { year: '2027', status: 'missing' },
          ],
        }}
        onVerify={onVerify}
        onReverify={onReverify}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Revérifier' }));

    expect(await screen.findByRole('img', { name: 'Refusée' })).toBeVisible();
    expect(onVerify).not.toHaveBeenCalled();
    expect(onReverify).toHaveBeenCalledWith(
      'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/edit',
    );
  });
});
