import { fold } from '@/src/domain/shared/text';

const FRENCH =
  /^il y a(?:\s+environ)?\s+(\d+)\s+(minutes?|heures?|jours?|semaines?|mois|ans?)$/i;
const ENGLISH =
  /^(\d+)\s+(minutes?|hours?|days?|weeks?|months?|years?)\s+ago$/i;

type Shift = {
  amount: number;
  unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
};

export function estimateAppliedOn(relativeDate: string, now: Date): string {
  const shift = readShift(relativeDate);

  if (shift === null) {
    return '';
  }

  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (shift.unit === 'day') {
    date.setDate(date.getDate() - shift.amount);
  }

  if (shift.unit === 'week') {
    date.setDate(date.getDate() - shift.amount * 7);
  }

  if (shift.unit === 'month') {
    date.setMonth(date.getMonth() - shift.amount);
  }

  if (shift.unit === 'year') {
    date.setFullYear(date.getFullYear() - shift.amount);
  }

  return formatCivilDate(date);
}

function readShift(relativeDate: string): Shift | null {
  const french = FRENCH.exec(fold(relativeDate));
  const english = french === null ? ENGLISH.exec(fold(relativeDate)) : null;
  const match = french ?? english;

  if (match === null) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = unitOf(match[2] ?? '');

  if (!Number.isInteger(amount) || amount < 0 || unit === null) {
    return null;
  }

  return { amount, unit };
}

function unitOf(value: string): Shift['unit'] | null {
  if (value.startsWith('minute')) {
    return 'minute';
  }

  if (value.startsWith('heure') || value.startsWith('hour')) {
    return 'hour';
  }

  if (value.startsWith('jour') || value.startsWith('day')) {
    return 'day';
  }

  if (value.startsWith('semaine') || value.startsWith('week')) {
    return 'week';
  }

  if (value.startsWith('mois') || value.startsWith('month')) {
    return 'month';
  }

  if (value === 'an' || value === 'ans' || value.startsWith('year')) {
    return 'year';
  }

  return null;
}

function formatCivilDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${String(date.getFullYear())}-${month}-${day}`;
}
