import { collapseWhitespace, fold } from '@/src/domain/shared/text';

export type SalaryEstimate = {
  monthlySalary: string;
  annualSalary: string;
};

const EMPTY_SALARY: SalaryEstimate = {
  monthlySalary: '',
  annualSalary: '',
};

type PayPeriod = 'year' | 'month';

type SalaryAmount = {
  euros: number;
  period: PayPeriod;
};

const AMOUNT_PATTERN =
  /(\d{1,3}(?:[ \u00a0.]\d{3})+|\d+(?:[.,]\d+)?)(\s*[kK])?/g;

export function estimateSalary(texts: readonly string[]): SalaryEstimate {
  const amounts = texts.flatMap(parseAmounts);

  if (amounts.length === 0) {
    return EMPTY_SALARY;
  }

  const averageAnnual =
    amounts.reduce((sum, amount) => sum + annualEuros(amount), 0) /
    amounts.length;
  const monthly = Math.round(averageAnnual / 12);

  if (!Number.isFinite(monthly) || monthly <= 0) {
    return EMPTY_SALARY;
  }

  return {
    monthlySalary: String(monthly),
    annualSalary: String(monthly * 12),
  };
}

function parseAmounts(raw: string): SalaryAmount[] {
  const text = collapseWhitespace(raw);

  if (!text.includes('€')) {
    return [];
  }

  const period = periodOf(text);
  const amounts: SalaryAmount[] = [];

  for (const match of text.matchAll(AMOUNT_PATTERN)) {
    const hasKilo = /[kK]/.test(match[2] ?? '');
    const euros = toEuros(match[1] ?? '', hasKilo);
    const resolved = period ?? (hasKilo ? 'year' : null);

    if (euros === null || resolved === null) {
      continue;
    }

    amounts.push({ euros, period: resolved });
  }

  return amounts;
}

function normalizeAmount(compact: string): string {
  if (/^\d{1,3}(?:\.\d{3})+$/.test(compact)) {
    return compact.replace(/\./g, '');
  }

  if (/^\d{1,3}(?:,\d{3})+$/.test(compact)) {
    return compact.replace(/,/g, '');
  }

  return compact.replace(',', '.');
}

function annualEuros(amount: SalaryAmount): number {
  return amount.period === 'year' ? amount.euros : amount.euros * 12;
}

function toEuros(raw: string, hasKilo: boolean): number | null {
  const compact = raw.replace(/[\s\u00a0]/g, '');
  const numeric = normalizeAmount(compact);

  const value = Number(numeric);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const euros = hasKilo ? value * 1000 : value;

  if (euros < 100 || euros > 10_000_000) {
    return null;
  }

  return euros;
}

function periodOf(text: string): PayPeriod | null {
  const value = fold(text);

  if (
    /\bpar mois\b/.test(value) ||
    /\bmensuel(?:le)?\b/.test(value) ||
    /\bper month\b/.test(value) ||
    /\ba month\b/.test(value) ||
    /\/(?:mois|month|mo)\b/.test(value)
  ) {
    return 'month';
  }

  if (
    /\bpar (?:an|ans|yr|year)\b/.test(value) ||
    /\bannuel(?:le)?\b/.test(value) ||
    /\b(?:per year|a year|yearly)\b/.test(value) ||
    /\/(?:an|yr|year)\b/.test(value)
  ) {
    return 'year';
  }

  return null;
}
