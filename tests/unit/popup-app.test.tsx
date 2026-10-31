import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SavedSpreadsheetSettings } from '@/src/application/dto/spreadsheet-messages';
import type { ActiveJobMessage } from '@/src/application/dto/job-offer-messages';
import {
  PopupApp,
  reloadLinkedInSourceTab,
} from '@/src/presentation/popup/PopupApp';

const savedSpreadsheet: SavedSpreadsheetSettings = {
  spreadsheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd',
  url: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/edit',
  title: 'Candidatures',
  annualSheets: ['2026'],
  writeAccess: 'verified',
  years: [],
};

describe('PopupApp', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps Candidature closed until a spreadsheet is connected', async () => {
    stubBrowser(null);

    render(<PopupApp />);

    expect(await screen.findByLabelText('URL du classeur')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Candidature' })).toBeDisabled();
    expect(screen.queryByRole('tabpanel', { name: 'Candidature' })).toBeNull();
  });

  it('keeps Candidature closed when no job link is recognized', async () => {
    stubBrowser(savedSpreadsheet);

    render(<PopupApp />);

    expect(await screen.findByLabelText('URL du classeur')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Candidature' })).toBeDisabled();
    expect(screen.queryByRole('tabpanel', { name: 'Candidature' })).toBeNull();
  });

  it('opens Candidature when a spreadsheet and a job link are recognized', async () => {
    stubBrowser(savedSpreadsheet, detectedJob);

    render(<PopupApp />);

    expect(
      await screen.findByRole('tabpanel', { name: 'Candidature' }),
    ).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Candidature' })).toBeEnabled();
  });
});

describe('reloadLinkedInSourceTab', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reloads the LinkedIn tab that opened the popup', async () => {
    const reload = vi.fn(() => Promise.resolve());

    vi.stubGlobal('browser', {
      tabs: {
        query: () =>
          Promise.resolve([
            {
              id: 7,
              url: 'https://www.linkedin.com/jobs/view/4468214437/',
            },
          ]),
        reload,
      },
    });

    await reloadLinkedInSourceTab();

    expect(reload).toHaveBeenCalledWith(7);
  });

  it('leaves a page that is not LinkedIn alone', async () => {
    const reload = vi.fn(() => Promise.resolve());

    vi.stubGlobal('browser', {
      tabs: {
        query: () => Promise.resolve([{ id: 7, url: 'https://example.com/' }]),
        reload,
      },
    });

    await reloadLinkedInSourceTab();

    expect(reload).not.toHaveBeenCalled();
  });
});

const detectedJob: ActiveJobMessage = {
  status: 'detected',
  application: {
    state: 'not_applied',
    statusLabel: '',
    relativeDate: '',
  },
  offer: {
    company: 'NovaSpace',
    country: 'France',
    region: 'Île-de-France',
    city: 'Paris',
    title: 'Web Developer',
    contractType: 'CDI',
    contractInferredFromFullTime: false,
    monthlySalary: '',
    annualSalary: '',
    url: 'https://www.linkedin.com/jobs/view/4475859401/',
  },
};

function stubBrowser(
  settings: SavedSpreadsheetSettings | null,
  job?: ActiveJobMessage,
): void {
  vi.stubGlobal('browser', {
    runtime: {
      sendMessage: (message: { type?: string }) =>
        Promise.resolve(
          message.type === 'get-spreadsheet-settings' ? settings : null,
        ),
    },
    storage: {
      onChanged: {
        addListener: () => undefined,
        removeListener: () => undefined,
      },
    },
    tabs: {
      query: () =>
        Promise.resolve(
          job == null
            ? []
            : [
                {
                  id: 7,
                  url: 'https://www.linkedin.com/jobs/view/4475859401/',
                },
              ],
        ),
      sendMessage: () => Promise.resolve(job ?? null),
    },
  });
}
