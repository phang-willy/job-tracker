const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

export function sheetSerialFromCivilDate(iso: string): number | null {
  const match = CIVIL_DATE.exec(iso);

  if (match?.[1] == null || match[2] == null || match[3] == null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);

  if (Number.isNaN(utc)) {
    return null;
  }

  const serial = Math.round((utc - EXCEL_EPOCH_UTC) / DAY_MS);
  const back = civilDateFromSheetSerial(serial);

  return back === iso ? serial : null;
}

export function civilDateFromSheetSerial(serial: number): string | null {
  if (!Number.isFinite(serial)) {
    return null;
  }

  const date = new Date(EXCEL_EPOCH_UTC + Math.round(serial) * DAY_MS);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function civilDateFromCell(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return civilDateFromSheetSerial(value) ?? '';
  }

  if (typeof value === 'string' && CIVIL_DATE.test(value.trim())) {
    return value.trim();
  }

  return '';
}

export function civilDatesFromColumn(
  values: readonly unknown[][] | undefined,
): string[] {
  return (values ?? []).map((row) => civilDateFromCell(row[0]));
}

export function appliedDatesForInsertion(
  values: readonly unknown[][] | undefined,
): string[] | null {
  const rows = values ?? [];
  let lastOccupied = -1;

  for (let index = 0; index < rows.length; index += 1) {
    if (!sheetCellIsBlank(rows[index]?.[0])) {
      lastOccupied = index;
    }
  }

  const dates: string[] = [];

  for (let index = 0; index <= lastOccupied; index += 1) {
    const cell = rows[index]?.[0];

    if (sheetCellIsBlank(cell)) {
      dates.push('');
      continue;
    }

    const date = civilDateFromCell(cell);

    if (date === '') {
      return null;
    }

    dates.push(date);
  }

  return dates;
}

function sheetCellIsBlank(value: unknown): boolean {
  if (value == null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  return false;
}
