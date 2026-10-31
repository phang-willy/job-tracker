import { describe, expect, it, vi } from 'vitest';
import type {
  ApplicationCatalog,
  ApplicationWriter,
  SpreadsheetSettingsRepository,
} from '@/src/application/ports/spreadsheet';
import { LinkApplication } from '@/src/application/use-cases/link-application';
import type { ApplicationDraft } from '@/src/domain/spreadsheet/application-draft';
import type { StoredApplication } from '@/src/domain/spreadsheet/applications';
import { linkFailureMessage } from '@/src/presentation/popup/link-application';

const draft: ApplicationDraft = {
  company: 'Quik Hire',
  country: 'France',
  region: '',
  city: '',
  title: 'Frontend Web Developer',
  monthlySalary: '4000',
  annualSalary: '48000',
  appliedOn: '2026-10-15',
  contractType: 'CDI',
  url: 'https://www.linkedin.com/jobs/view/4467438805/',
};

const stored: StoredApplication = {
  sheet: '2026',
  row: 165,
  lastRow: 180,
  url: draft.url,
  status: '',
  appliedOn: draft.appliedOn,
};

const settings: SpreadsheetSettingsRepository = {
  load: () =>
    Promise.resolve({
      spreadsheetId: 'sheet',
      url: 'https://docs.google.com/spreadsheets/d/sheet',
      title: 'Suivi',
      annualSheets: ['2026'],
      writeAccess: 'verified',
      years: [],
    }),
  save: () => Promise.resolve(),
  clear: () => Promise.resolve(),
};

describe('LinkApplication', () => {
  it('does not insert when the normalized url is already stored', async () => {
    const writer: ApplicationWriter = { insertApplication: vi.fn() };
    const catalog: ApplicationCatalog = {
      listApplications: () => Promise.resolve({ status: 'ok', rows: [stored] }),
    };

    await expect(
      new LinkApplication(catalog, writer, settings).execute({
        ...draft,
        url: 'https://www.linkedin.com/jobs/view/4467438805/?trk=public',
      }),
    ).resolves.toEqual({ status: 'found', application: stored });
    expect(writer.insertApplication).not.toHaveBeenCalled();
  });

  it('inserts once, then returns the row reread from the sheet', async () => {
    const insertApplication = vi.fn(() =>
      Promise.resolve({ status: 'inserted' as const }),
    );
    const listApplications = vi
      .fn()
      .mockResolvedValueOnce({ status: 'ok', rows: [] })
      .mockResolvedValueOnce({ status: 'ok', rows: [stored] });

    await expect(
      new LinkApplication(
        { listApplications },
        { insertApplication },
        settings,
      ).execute(draft),
    ).resolves.toEqual({ status: 'found', application: stored });
    expect(insertApplication).toHaveBeenCalledOnce();
  });

  it('records that writing succeeded', async () => {
    const save = vi.fn(() => Promise.resolve());
    const writable = {
      ...settings,
      load: () =>
        Promise.resolve({
          spreadsheetId: 'sheet',
          url: 'https://docs.google.com/spreadsheets/d/sheet',
          title: 'Suivi',
          annualSheets: ['2026'],
          writeAccess: 'unverified' as const,
          years: [],
        }),
      save,
    };

    await new LinkApplication(
      {
        listApplications: vi
          .fn()
          .mockResolvedValueOnce({ status: 'ok', rows: [] })
          .mockResolvedValueOnce({ status: 'ok', rows: [stored] }),
      },
      {
        insertApplication: () => Promise.resolve({ status: 'inserted' }),
      },
      writable,
    ).execute(draft);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ writeAccess: 'verified' }),
    );
  });

  it('does not write into a year whose headers failed the check', async () => {
    const insertApplication = vi.fn();

    await expect(
      new LinkApplication(
        {
          listApplications: () => Promise.resolve({ status: 'ok', rows: [] }),
        },
        { insertApplication },
        {
          load: () =>
            Promise.resolve({
              spreadsheetId: 'sheet',
              url: 'https://docs.google.com/spreadsheets/d/sheet',
              title: 'Suivi',
              annualSheets: ['2025'],
              writeAccess: 'verified',
              years: [
                { year: '2025', status: 'ok' },
                { year: '2026', status: 'invalid' },
                { year: '2027', status: 'missing' },
              ],
            }),
          save: () => Promise.resolve(),
          clear: () => Promise.resolve(),
        },
      ).execute(draft),
    ).resolves.toEqual({ status: 'incompatible_sheet', year: '2026' });
    expect(insertApplication).not.toHaveBeenCalled();
    expect(
      linkFailureMessage({ status: 'incompatible_sheet', year: '2026' }),
    ).toBe(
      "L'onglet 2026 n'a pas la structure attendue. Aucune ligne n'a été ajoutée.",
    );
  });

  it('reports an unsorted column without pretending the row was added', async () => {
    const result = await new LinkApplication(
      {
        listApplications: () => Promise.resolve({ status: 'ok', rows: [] }),
      },
      {
        insertApplication: () => Promise.resolve({ status: 'unsorted' }),
      },
      settings,
    ).execute(draft);

    expect(result).toEqual({ status: 'unsorted' });

    if (result.status === 'unsorted') {
      expect(linkFailureMessage(result)).toBe(
        "La colonne Postulé le n'est pas dans l'ordre, ou une date n'est pas lisible. Aucune ligne n'a été ajoutée.",
      );
    }
  });

  it('accepts a row found on reread when the write response was lost', async () => {
    const listApplications = vi
      .fn()
      .mockResolvedValueOnce({ status: 'ok', rows: [] })
      .mockResolvedValueOnce({ status: 'ok', rows: [stored] });

    await expect(
      new LinkApplication(
        { listApplications },
        {
          insertApplication: () =>
            Promise.resolve({ status: 'unavailable', detail: 'timeout' }),
        },
        settings,
      ).execute(draft),
    ).resolves.toEqual({ status: 'found', application: stored });
  });

  it('refuses an empty company before calling the sheet', async () => {
    const listApplications = vi.fn();

    await expect(
      new LinkApplication(
        { listApplications },
        { insertApplication: vi.fn() },
        settings,
      ).execute({ ...draft, company: '  ' }),
    ).resolves.toEqual({ status: 'invalid', field: 'company' });
    expect(listApplications).not.toHaveBeenCalled();
  });
});
