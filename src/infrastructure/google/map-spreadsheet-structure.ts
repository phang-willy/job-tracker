import {
  isAnnualSheetTitle,
  type AnnualSheetSnapshot,
  type ValidatedColumn,
} from '@/src/domain/spreadsheet/structure';

type GridCell = {
  formattedValue?: string;
  dataValidation?: unknown;
};

type GridSheet = {
  properties?: { title?: string };
  data?: Array<{
    rowData?: Array<{
      values?: GridCell[];
    }>;
  }>;
};

export type SpreadsheetMetadata = {
  properties?: { title?: string };
  sheets?: Array<{ properties?: { title?: string } }>;
};

const VALIDATION_INDEX: Record<ValidatedColumn, number> = {
  Pays: 1,
  Type: 11,
  CV: 12,
  Statut: 14,
};

export function annualSheetTitles(metadata: SpreadsheetMetadata): string[] {
  return (metadata.sheets ?? []).flatMap((sheet) => {
    const title = sheet.properties?.title;

    if (title == null || !isAnnualSheetTitle(title)) {
      return [];
    }

    return [title];
  });
}

export function mapAnnualSheetGrid(
  sheet: GridSheet,
): AnnualSheetSnapshot | null {
  const title = sheet.properties?.title;

  if (title == null || !isAnnualSheetTitle(title)) {
    return null;
  }

  const rows = sheet.data?.[0]?.rowData;
  const headerRow = rows?.[0];
  const valueRow = rows?.[1];

  return {
    title,
    headers: Array.from(
      { length: 17 },
      (_, index) => headerRow?.values?.[index]?.formattedValue?.trim() ?? '',
    ),
    validations: {
      Pays: hasValidation(headerRow, valueRow, VALIDATION_INDEX.Pays),
      Type: hasValidation(headerRow, valueRow, VALIDATION_INDEX.Type),
      CV: hasValidation(headerRow, valueRow, VALIDATION_INDEX.CV),
      Statut: hasValidation(headerRow, valueRow, VALIDATION_INDEX.Statut),
    },
  };
}

function hasValidation(
  headerRow: { values?: GridCell[] } | undefined,
  valueRow: { values?: GridCell[] } | undefined,
  index: number,
): boolean {
  return (
    headerRow?.values?.[index]?.dataValidation != null ||
    valueRow?.values?.[index]?.dataValidation != null
  );
}

export function quoteSheetRange(title: string): string {
  return `'${title.replaceAll("'", "''")}'!A1:Q2`;
}
