import { sheetSerialFromCivilDate } from '@/src/domain/spreadsheet/sheet-date';

export type ApplicationDraft = {
  company: string;
  country: string;
  region: string;
  city: string;
  title: string;
  monthlySalary: string;
  annualSalary: string;
  appliedOn: string;
  contractType: string;
  url: string;
};

export type ApplicationCell =
  | { column: number; stringValue: string }
  | { column: number; numberValue: number };

export function applicationCells(
  draft: ApplicationDraft,
  options: { includeAnnualSalary: boolean },
): ApplicationCell[] {
  const cells: ApplicationCell[] = [
    { column: 0, stringValue: draft.company },
    { column: 1, stringValue: draft.country },
    { column: 2, stringValue: draft.region },
    { column: 3, stringValue: draft.city },
    { column: 4, stringValue: draft.title },
  ];
  const monthly = numericSalary(draft.monthlySalary);

  if (monthly != null) {
    cells.push({ column: 5, numberValue: monthly });
  }

  if (options.includeAnnualSalary) {
    const annual = numericSalary(draft.annualSalary);

    if (annual != null) {
      cells.push({ column: 6, numberValue: annual });
    }
  }

  const serial = sheetSerialFromCivilDate(draft.appliedOn);

  if (serial != null) {
    cells.push({ column: 7, numberValue: serial });
  }

  if (draft.contractType !== '') {
    cells.push({ column: 11, stringValue: draft.contractType });
  }

  cells.push({ column: 13, stringValue: draft.url });

  return cells;
}

function numericSalary(value: string): number | null {
  const normalized = value.replaceAll(' ', '').replace(',', '.');

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : null;
}
