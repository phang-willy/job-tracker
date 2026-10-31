import { describe, expect, it } from 'vitest';
import type {
  SavedSpreadsheetSettings,
  SpreadsheetReader,
  SpreadsheetSettingsRepository,
  WriteProbe,
} from '@/src/application/ports/spreadsheet';
import { ValidateSpreadsheetConfig } from '@/src/application/use-cases/validate-spreadsheet-config';

const spreadsheetUrl =
  'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/edit';

function reader(
  read: Awaited<ReturnType<SpreadsheetReader['readStructure']>>,
  write: WriteProbe = { status: 'ok' },
): SpreadsheetReader {
  return {
    readStructure: () => Promise.resolve(read),
    probeWriteAccess: () => Promise.resolve(write),
  };
}

function memorySettings(): SpreadsheetSettingsRepository & {
  saved: SavedSpreadsheetSettings | null;
} {
  const store: { saved: SavedSpreadsheetSettings | null } = { saved: null };

  return {
    get saved() {
      return store.saved;
    },
    save(settings) {
      store.saved = settings;
      return Promise.resolve();
    },
    load() {
      return Promise.resolve(store.saved);
    },
    clear() {
      store.saved = null;
      return Promise.resolve();
    },
  };
}

const compatibleSheet = {
  title: '2026',
  headers: [
    'Société',
    'Pays',
    'Région / Dep',
    'Ville',
    'Poste',
    'Salaire mensuel',
    'Salaire annuel',
    'Postulé le',
    'Expire le',
    'Contrat Début',
    'Contrat Fin',
    'Type',
    'CV',
    'Lien',
    'Statut',
    'Date Retour 1',
    'Retour 1',
  ],
  validations: { Pays: true, Type: true, CV: true, Statut: true },
};

const during2026 = () => new Date(2026, 9, 14);

describe('ValidateSpreadsheetConfig', () => {
  it('does not call Google when the URL is not a spreadsheet', async () => {
    let readCalled = false;
    let writeCalled = false;
    const useCase = new ValidateSpreadsheetConfig(
      {
        readStructure() {
          readCalled = true;
          return Promise.resolve({ status: 'access_denied' });
        },
        probeWriteAccess() {
          writeCalled = true;
          return Promise.resolve({ status: 'ok' });
        },
      },
      memorySettings(),
      during2026,
    );

    await expect(useCase.execute('https://example.com')).resolves.toEqual({
      status: 'invalid_url',
    });
    expect(readCalled).toBe(false);
    expect(writeCalled).toBe(false);
  });

  it('saves a compatible spreadsheet when Google accepts the write', async () => {
    const settings = memorySettings();
    const useCase = new ValidateSpreadsheetConfig(
      reader({
        status: 'ok',
        title: 'Candidatures',
        annualTitles: ['1990', '2025', '2026', '2099'],
        sheets: [compatibleSheet, { ...compatibleSheet, title: '2025' }],
      }),
      settings,
      during2026,
    );

    await expect(useCase.execute(spreadsheetUrl)).resolves.toMatchObject({
      status: 'compatible',
      title: 'Candidatures',
      writeAccess: 'verified',
      annualSheets: ['2025', '2026'],
    });
    expect(settings.saved?.writeAccess).toBe('verified');
  });

  it('saves a readable spreadsheet when Google refuses the write', async () => {
    const settings = memorySettings();
    const useCase = new ValidateSpreadsheetConfig(
      reader(
        {
          status: 'ok',
          title: 'Candidatures',
          annualTitles: ['2026'],
          sheets: [compatibleSheet],
        },
        { status: 'denied' },
      ),
      settings,
      during2026,
    );

    await expect(useCase.execute(spreadsheetUrl)).resolves.toMatchObject({
      status: 'compatible',
      writeAccess: 'denied',
    });
    expect(settings.saved?.writeAccess).toBe('denied');
  });

  it('saves a readable spreadsheet when write rights stay unverified', async () => {
    const settings = memorySettings();
    const useCase = new ValidateSpreadsheetConfig(
      reader(
        {
          status: 'ok',
          title: 'Candidatures',
          annualTitles: ['2026'],
          sheets: [compatibleSheet],
        },
        { status: 'unverified' },
      ),
      settings,
      during2026,
    );

    await expect(useCase.execute(spreadsheetUrl)).resolves.toMatchObject({
      status: 'compatible',
      writeAccess: 'unverified',
    });
    expect(settings.saved?.writeAccess).toBe('unverified');
  });

  it('keeps a readable spreadsheet when the capability check cannot reach Google', async () => {
    const settings = memorySettings();
    const useCase = new ValidateSpreadsheetConfig(
      reader(
        {
          status: 'ok',
          title: 'Candidatures',
          annualTitles: ['2026'],
          sheets: [compatibleSheet],
        },
        { status: 'unavailable', detail: '503' },
      ),
      settings,
      during2026,
    );

    await expect(useCase.execute(spreadsheetUrl)).resolves.toMatchObject({
      status: 'compatible',
      writeAccess: 'unverified',
    });
    expect(settings.saved?.writeAccess).toBe('unverified');
  });

  it('does not save when the Google token is expired', async () => {
    const settings = memorySettings();
    const useCase = new ValidateSpreadsheetConfig(
      reader(
        {
          status: 'ok',
          title: 'Candidatures',
          annualTitles: ['2026'],
          sheets: [compatibleSheet],
        },
        { status: 'unauthenticated' },
      ),
      settings,
      during2026,
    );

    await expect(useCase.execute(spreadsheetUrl)).resolves.toEqual({
      status: 'unauthenticated',
    });
    expect(settings.saved).toBeNull();
  });

  it('reports a broken neighbor without checking years further away', async () => {
    let writeCalled = false;
    const settings = memorySettings();
    const brokenPreviousYear = {
      ...compatibleSheet,
      title: '2025',
      headers: compatibleSheet.headers.map((header, index) =>
        index === 0 ? 'Company' : header,
      ),
    };
    const useCase = new ValidateSpreadsheetConfig(
      {
        readStructure: () =>
          Promise.resolve({
            status: 'ok' as const,
            title: 'Candidatures',
            annualTitles: ['1990', '2025', '2026', '2099'],
            sheets: [brokenPreviousYear, compatibleSheet],
          }),
        probeWriteAccess: () => {
          writeCalled = true;
          return Promise.resolve({ status: 'ok' as const });
        },
      },
      settings,
      during2026,
    );

    await expect(useCase.execute(spreadsheetUrl)).resolves.toMatchObject({
      status: 'incompatible',
      years: [
        { year: '2025', status: 'invalid' },
        { year: '2026', status: 'ok' },
        { year: '2027', status: 'missing' },
      ],
    });
    expect(writeCalled).toBe(false);
    expect(settings.saved?.years).toEqual([
      { year: '2025', status: 'invalid' },
      { year: '2026', status: 'ok' },
      { year: '2027', status: 'missing' },
    ]);
    expect(settings.saved?.writeAccess).toBe('unverified');
  });

  it('does not save a spreadsheet whose headers do not match', async () => {
    const settings = memorySettings();
    const useCase = new ValidateSpreadsheetConfig(
      reader({
        status: 'ok',
        title: 'Candidatures',
        annualTitles: [],
        sheets: [],
      }),
      settings,
      during2026,
    );

    await expect(useCase.execute(spreadsheetUrl)).resolves.toMatchObject({
      status: 'incompatible',
      problems: [{ code: 'no_annual_sheet' }],
    });
    expect(settings.saved?.years[1]).toEqual({
      year: '2026',
      status: 'missing',
    });
  });

  it('reports a missing spreadsheet without saving it', async () => {
    const settings = memorySettings();
    const useCase = new ValidateSpreadsheetConfig(
      reader({ status: 'access_denied', notFound: true }),
      settings,
      during2026,
    );

    await expect(useCase.execute(spreadsheetUrl)).resolves.toEqual({
      status: 'access_denied',
      spreadsheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd',
      notFound: true,
    });
    expect(settings.saved).toBeNull();
  });

  it('does not save when Google Sheets cannot be reached', async () => {
    const settings = memorySettings();
    const useCase = new ValidateSpreadsheetConfig(
      reader({ status: 'unavailable', detail: 'Failed to fetch' }),
      settings,
      during2026,
    );

    await expect(useCase.execute(spreadsheetUrl)).resolves.toEqual({
      status: 'unavailable',
      detail: 'Failed to fetch',
    });
    expect(settings.saved).toBeNull();
  });

  it('keeps a write that already succeeded when Drive cannot recheck it', async () => {
    const settings = memorySettings();
    await settings.save({
      spreadsheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd',
      url: spreadsheetUrl,
      title: 'Candidatures',
      annualSheets: ['2026'],
      writeAccess: 'verified',
      years: [],
    });
    const useCase = new ValidateSpreadsheetConfig(
      reader(
        {
          status: 'ok',
          title: 'Candidatures',
          annualTitles: ['2026'],
          sheets: [compatibleSheet],
        },
        { status: 'unverified' },
      ),
      settings,
      during2026,
    );

    await expect(useCase.execute(spreadsheetUrl)).resolves.toMatchObject({
      status: 'compatible',
      writeAccess: 'verified',
    });
    expect(settings.saved?.writeAccess).toBe('verified');
  });

  it('reports a refused spreadsheet without saving it', async () => {
    const settings = memorySettings();
    const useCase = new ValidateSpreadsheetConfig(
      reader({ status: 'access_denied' }),
      settings,
      during2026,
    );

    await expect(useCase.execute(spreadsheetUrl)).resolves.toMatchObject({
      status: 'access_denied',
    });
    expect(settings.saved).toBeNull();
  });
});
