const SPREADSHEET_URL = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

const RAW_SPREADSHEET_ID = /^[a-zA-Z0-9-_]{20,}$/;

export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = SPREADSHEET_URL.exec(trimmed);

  if (fromUrl?.[1] != null) {
    return fromUrl[1];
  }

  if (RAW_SPREADSHEET_ID.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export const SPREADSHEET_HEADERS = [
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
] as const;

const VALIDATED_COLUMNS = [
  { index: 1, name: 'Pays' },
  { index: 11, name: 'Type' },
  { index: 12, name: 'CV' },
  { index: 14, name: 'Statut' },
] as const;

export type ValidatedColumn = (typeof VALIDATED_COLUMNS)[number]['name'];

const ANNUAL_SHEET_TITLE = /^(19|20)\d{2}$/;

export function isAnnualSheetTitle(title: string): boolean {
  return ANNUAL_SHEET_TITLE.test(title);
}

export type AnnualSheetSnapshot = {
  title: string;
  headers: string[];
  validations: Record<ValidatedColumn, boolean>;
};

export type StructureProblem =
  | { code: 'no_annual_sheet' }
  | {
      code: 'header_mismatch';
      sheet: string;
      column: string;
      expected: string;
      actual: string;
    }
  | {
      code: 'missing_validation';
      sheet: string;
      column: ValidatedColumn;
    };

export type YearCheckStatus = 'ok' | 'invalid' | 'missing';

export type YearCheck = {
  year: string;
  status: YearCheckStatus;
};

export function titlesToVerify(
  existingTitles: readonly string[],
  year: number,
): string[] {
  return [year - 1, year, year + 1]
    .map(String)
    .filter((title) => existingTitles.includes(title));
}

export function assessRelevantYears(
  existingTitles: readonly string[],
  sheets: readonly AnnualSheetSnapshot[],
  year: number,
): { years: YearCheck[]; problems: StructureProblem[] } {
  const problems: StructureProblem[] = [];
  const years = [year - 1, year, year + 1].map((value) => {
    const title = String(value);

    if (!existingTitles.includes(title)) {
      if (value === year) {
        problems.push({ code: 'no_annual_sheet' });
      }

      return { year: title, status: 'missing' as const };
    }

    const sheet = sheets.find((item) => item.title === title);
    const sheetProblems =
      sheet == null
        ? [{ code: 'no_annual_sheet' as const }]
        : [...headerProblems(sheet), ...validationProblems(sheet)];
    problems.push(...sheetProblems);

    return {
      year: title,
      status:
        sheetProblems.length === 0 ? ('ok' as const) : ('invalid' as const),
    };
  });

  return { years, problems };
}

export function assessSheetStructure(
  sheets: readonly AnnualSheetSnapshot[],
): StructureProblem[] {
  if (sheets.length === 0) {
    return [{ code: 'no_annual_sheet' }];
  }

  return sheets.flatMap((sheet) => [
    ...headerProblems(sheet),
    ...validationProblems(sheet),
  ]);
}

function headerProblems(sheet: AnnualSheetSnapshot): StructureProblem[] {
  return SPREADSHEET_HEADERS.flatMap((expected, index) => {
    const actual = sheet.headers[index]?.trim() ?? '';

    if (actual === expected) {
      return [];
    }

    return [
      {
        code: 'header_mismatch' as const,
        sheet: sheet.title,
        column: columnLetter(index),
        expected,
        actual,
      },
    ];
  });
}

function validationProblems(sheet: AnnualSheetSnapshot): StructureProblem[] {
  return VALIDATED_COLUMNS.flatMap((column) => {
    if (sheet.validations[column.name]) {
      return [];
    }

    return [
      {
        code: 'missing_validation' as const,
        sheet: sheet.title,
        column: column.name,
      },
    ];
  });
}

function columnLetter(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}
