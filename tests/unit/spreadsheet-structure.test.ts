import { describe, expect, it } from 'vitest';
import {
  assessRelevantYears,
  assessSheetStructure,
  parseSpreadsheetId,
  titlesToVerify,
  type AnnualSheetSnapshot,
} from '@/src/domain/spreadsheet/structure';

const headers = [
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
];

function sheet(
  overrides: Partial<AnnualSheetSnapshot> = {},
): AnnualSheetSnapshot {
  return {
    title: '2026',
    headers,
    validations: { Pays: true, Type: true, CV: true, Statut: true },
    ...overrides,
  };
}

describe('parseSpreadsheetId', () => {
  it('reads the id from a Google Sheets URL', () => {
    expect(
      parseSpreadsheetId(
        'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/edit?gid=0',
      ),
    ).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd');
  });

  it('rejects a page that is not a spreadsheet', () => {
    expect(parseSpreadsheetId('https://example.com/sheet')).toBeNull();
  });
});

describe('titlesToVerify', () => {
  it('keeps the current year and only the neighbors that exist', () => {
    const titles = ['1990', '2025', '2026', '2099'];

    expect(titlesToVerify(titles, 2026)).toEqual(['2025', '2026']);
  });
});

describe('assessRelevantYears', () => {
  it('marks a missing neighbor as absent and a broken one as invalid', () => {
    expect(
      assessRelevantYears(
        ['2025', '2026'],
        [
          sheet({
            title: '2025',
            headers: headers.map((header, index) =>
              index === 0 ? 'Company' : header,
            ),
          }),
          sheet(),
        ],
        2026,
      ),
    ).toMatchObject({
      years: [
        { year: '2025', status: 'invalid' },
        { year: '2026', status: 'ok' },
        { year: '2027', status: 'missing' },
      ],
    });
  });
});

describe('assessSheetStructure', () => {
  it('accepts annual sheets with the expected headers and lists', () => {
    expect(assessSheetStructure([sheet()])).toEqual([]);
  });

  it('reports a missing annual sheet, a wrong header, and a missing list', () => {
    expect(assessSheetStructure([])).toEqual([{ code: 'no_annual_sheet' }]);
    expect(
      assessSheetStructure([
        sheet({
          headers: headers.map((header, index) =>
            index === 0 ? 'Company' : header,
          ),
          validations: { Pays: true, Type: true, CV: false, Statut: true },
        }),
      ]),
    ).toEqual([
      {
        code: 'header_mismatch',
        sheet: '2026',
        column: 'A',
        expected: 'Société',
        actual: 'Company',
      },
      { code: 'missing_validation', sheet: '2026', column: 'CV' },
    ]);
  });
});
