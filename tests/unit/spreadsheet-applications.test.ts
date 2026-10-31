import { describe, expect, it } from 'vitest';
import { FindExistingApplication } from '@/src/application/use-cases/find-existing-application';
import type { ApplicationCatalog } from '@/src/application/ports/spreadsheet';
import type { SpreadsheetSettingsRepository } from '@/src/application/ports/spreadsheet';
import {
  chronologicalInsertionIndex,
  columnInsertionIndex,
  findMatchingApplication,
  sheetPositionLabel,
  type StoredApplication,
} from '@/src/domain/spreadsheet/applications';

const rows: StoredApplication[] = [
  {
    sheet: '2025',
    row: 4,
    lastRow: 20,
    url: 'https://www.linkedin.com/jobs/view/111/?trackingId=old',
    status: 'Entretien',
    appliedOn: '2025-03-01',
  },
  {
    sheet: '2026',
    row: 8,
    lastRow: 40,
    url: 'https://www.linkedin.com/jobs/view/4479813416/',
    status: 'Envoyée',
    appliedOn: '2026-01-12',
  },
];

describe('sheetPositionLabel', () => {
  it('uses ligne for 0 or 1 and lignes from 2', () => {
    expect(sheetPositionLabel('2026', 1, 0)).toBe('2026 - 1/0 ligne');
    expect(sheetPositionLabel('2026', 1, 1)).toBe('2026 - 1/1 ligne');
    expect(sheetPositionLabel('2026', 2, 2)).toBe('2026 - 2/2 lignes');
    expect(sheetPositionLabel('2026', 12, 180)).toBe('2026 - 12/180 lignes');
  });
});

describe('findMatchingApplication', () => {
  it('matches a tracked historical url to the normalized offer link', () => {
    expect(
      findMatchingApplication(
        rows,
        'https://www.linkedin.com/jobs/search-results/?currentJobId=111&trackingId=abc',
      ),
    ).toMatchObject({ sheet: '2025', status: 'Entretien' });
  });

  it('matches the job id stored in the Lien column', () => {
    expect(
      findMatchingApplication(
        [
          {
            sheet: '2026',
            row: 40,
            lastRow: 40,
            url: 'https://www.linkedin.com/jobs/view/4430481397/?trk=sheet',
            status: 'Envoyée',
            appliedOn: '2026-06-12',
          },
        ],
        'https://www.linkedin.com/jobs/view/4430481397/',
      ),
    ).toMatchObject({ sheet: '2026', row: 40, status: 'Envoyée' });
  });

  it('returns nothing when the normalized url is absent', () => {
    expect(
      findMatchingApplication(rows, 'https://www.linkedin.com/jobs/view/999/'),
    ).toBeNull();
  });
});

describe('chronologicalInsertionIndex', () => {
  it('inserts a date into an ascending column H', () => {
    expect(
      chronologicalInsertionIndex(
        ['2026-01-01', '2026-01-12', '2026-02-02'],
        '2026-01-20',
      ),
    ).toBe(2);
  });

  it('refuses a column that is not in ascending order', () => {
    expect(
      chronologicalInsertionIndex(['2026-02-02', '2026-01-01'], '2026-01-20'),
    ).toBeNull();
  });
});

describe('columnInsertionIndex', () => {
  it('ignores empty rows after the last candidature', () => {
    expect(
      columnInsertionIndex(['2026-01-01', '2026-03-01', ''], '2026-02-01'),
    ).toBe(1);
  });

  it('refuses a hole in the middle of column H', () => {
    expect(
      columnInsertionIndex(['2026-01-01', '', '2026-03-01'], '2026-02-01'),
    ).toBeNull();
  });
});

describe('FindExistingApplication', () => {
  it('returns the stored status without writing a row', async () => {
    const catalog: ApplicationCatalog = {
      listApplications: () => Promise.resolve({ status: 'ok', rows }),
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

    await expect(
      new FindExistingApplication(catalog, settings).execute(
        'https://www.linkedin.com/jobs/view/4479813416/?trk=public',
      ),
    ).resolves.toEqual({
      status: 'found',
      application: rows[1],
    });
  });

  it('reports a missing url when the sheet has no matching link', async () => {
    const catalog: ApplicationCatalog = {
      listApplications: () => Promise.resolve({ status: 'ok', rows: [] }),
    };

    await expect(
      new FindExistingApplication(catalog, {
        load: () =>
          Promise.resolve({
            spreadsheetId: 'sheet',
            url: '',
            title: '',
            annualSheets: [],
            writeAccess: 'unverified',
            years: [],
          }),
        save: () => Promise.resolve(),
        clear: () => Promise.resolve(),
      }).execute('https://www.linkedin.com/jobs/view/4479813416/'),
    ).resolves.toEqual({ status: 'missing' });
  });

  it('matches every tracker row with one sheet read', async () => {
    let reads = 0;
    const catalog: ApplicationCatalog = {
      listApplications: () => {
        reads += 1;
        return Promise.resolve({ status: 'ok', rows });
      },
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

    await expect(
      new FindExistingApplication(catalog, settings).executeMany([
        'https://www.linkedin.com/jobs/view/4479813416/',
        'https://www.linkedin.com/jobs/view/999/',
      ]),
    ).resolves.toMatchObject({
      status: 'ok',
      matches: [
        {
          status: 'found',
          application: { sheet: '2026', row: 8, lastRow: 40 },
        },
        { url: 'https://www.linkedin.com/jobs/view/999/', status: 'missing' },
      ],
    });
    expect(reads).toBe(1);
  });
});
