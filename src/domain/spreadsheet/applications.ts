import { linkedinJobIdInText } from '@/src/domain/job-offer/normalizers/linkedin-url';

export type StoredApplication = {
  sheet: string;
  row: number;
  lastRow: number;
  url: string;
  status: string;
  appliedOn: string;
};

export function sheetPositionLabel(
  sheet: string,
  row: number,
  total: number,
): string {
  const word = total <= 1 ? 'ligne' : 'lignes';

  return `${sheet} - ${String(row)}/${String(total)} ${word}`;
}

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function jobUrlsMatch(left: string, right: string): boolean {
  const leftId = linkedinJobIdInText(left);
  const rightId = linkedinJobIdInText(right);

  if (leftId !== null || rightId !== null) {
    return leftId !== null && leftId === rightId;
  }

  const plainLeft = left.trim();
  const plainRight = right.trim();

  return plainLeft !== '' && plainLeft === plainRight;
}

export function findMatchingApplication(
  rows: readonly StoredApplication[],
  url: string,
): StoredApplication | null {
  return rows.find((row) => jobUrlsMatch(row.url, url)) ?? null;
}

export function chronologicalInsertionIndex(
  appliedDates: readonly string[],
  nextDate: string,
): number | null {
  if (!CIVIL_DATE.test(nextDate)) {
    return null;
  }

  const dates = appliedDates.filter((date) => date.trim() !== '');

  if (dates.some((date) => !CIVIL_DATE.test(date))) {
    return null;
  }

  for (let index = 1; index < dates.length; index += 1) {
    const previous = dates[index - 1];
    const current = dates[index];

    if (previous === undefined || current === undefined || current < previous) {
      return null;
    }
  }

  const insertion = dates.findIndex((date) => date > nextDate);

  return insertion === -1 ? dates.length : insertion;
}

export function filledColumnLength(values: readonly string[]): number {
  let last = -1;

  for (let index = 0; index < values.length; index += 1) {
    if (values[index]?.trim() !== '') {
      last = index;
    }
  }

  return last + 1;
}

export function columnInsertionIndex(
  appliedDates: readonly string[],
  nextDate: string,
): number | null {
  const length = filledColumnLength(appliedDates);
  const block = appliedDates.slice(0, length).map((date) => date.trim());

  if (block.some((date) => date === '')) {
    return null;
  }

  return chronologicalInsertionIndex(block, nextDate);
}
