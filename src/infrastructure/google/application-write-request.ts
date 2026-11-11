import type { ApplicationCell } from '@/src/domain/spreadsheet/application-draft';

const SHEET_COLUMN_COUNT = 17;
const LINK_COLUMN = 13;
const EVEN_ROW = sheetColor('#ffffff');
const ODD_ROW = sheetColor('#f6f8f9');
const LINK_TEXT = sheetColor('#4285f4');

export type ApplicationWritePlan = {
  sheetId: number;
  destinationIndex: number;
  insertRow: boolean;
  referenceIndex: number | null;
  copyFormula: boolean;
  cells: readonly ApplicationCell[];
  zebraGridIndexes?: readonly number[];
};

export type SheetBackground = {
  red?: number;
  green?: number;
  blue?: number;
};

export type RowPaint = 'zebra' | 'custom';

type PaintedCell = {
  effectiveFormat?: { backgroundColor?: SheetBackground };
};

type SheetProperties = {
  properties?: { title?: string; sheetId?: number };
};

export function annualSheetId(
  sheets: readonly SheetProperties[],
  year: string,
): number | null {
  const id = sheets.find((sheet) => sheet.properties?.title === year)
    ?.properties?.sheetId;

  return typeof id === 'number' ? id : null;
}

export function isSheetFormula(value: unknown): boolean {
  return typeof value === 'string' && value.trim().startsWith('=');
}

export function applicationWriteRequests(plan: ApplicationWritePlan): object[] {
  const requests: object[] = [];

  if (plan.insertRow) {
    requests.push({
      insertDimension: {
        range: {
          sheetId: plan.sheetId,
          dimension: 'ROWS',
          startIndex: plan.destinationIndex,
          endIndex: plan.destinationIndex + 1,
        },
        inheritFromBefore: true,
      },
    });
  }

  if (plan.referenceIndex != null) {
    requests.push(
      copyPaste(plan, 'PASTE_FORMAT', 0, SHEET_COLUMN_COUNT),
      copyPaste(plan, 'PASTE_DATA_VALIDATION', 0, SHEET_COLUMN_COUNT),
    );

    if (plan.copyFormula) {
      requests.push(copyPaste(plan, 'PASTE_FORMULA', 6, 7));
    }
  }

  for (const group of contiguous(
    plan.cells.filter((cell) => cell.column !== 7),
  )) {
    requests.push(valueUpdate(plan, group));
  }

  const date = plan.cells.find(
    (cell) => cell.column === 7 && 'numberValue' in cell,
  );

  if (date != null && 'numberValue' in date) {
    requests.push(dateUpdate(plan, date.numberValue));
  }

  for (const gridIndex of plan.zebraGridIndexes ?? [plan.destinationIndex]) {
    requests.push(rowBackground(plan.sheetId, gridIndex));
  }

  requests.push(linkTextColor(plan));

  return requests;
}

export function paintsFromGrid(
  rows: readonly ({ values?: readonly PaintedCell[] } | null | undefined)[],
  dateCount: number,
): RowPaint[] {
  return Array.from({ length: dateCount }, (_, index) =>
    rowPaint(
      rows[index]?.values?.map((cell) => cell.effectiveFormat?.backgroundColor),
    ),
  );
}

export function rowPaint(
  colors: readonly (SheetBackground | null | undefined)[] | undefined,
): RowPaint {
  return keepsCustomBackground(colors ?? []) ? 'custom' : 'zebra';
}

export function zebraGridIndexesAfterInsert(
  paints: readonly RowPaint[],
  insertionIndex: number,
): number[] {
  const indexes = [insertionIndex + 1];

  for (let index = insertionIndex; index < paints.length; index += 1) {
    if (paints[index] !== 'zebra') {
      continue;
    }

    indexes.push(index + 2);
  }

  return indexes;
}

function keepsCustomBackground(
  colors: readonly (SheetBackground | null | undefined)[],
): boolean {
  if (colors.length === 0) {
    return false;
  }

  const painted = colors.map(normalizeBackground);
  const first = painted[0];

  if (first == null || painted.some((color) => !sameColor(color, first))) {
    return true;
  }

  return !sameColor(first, EVEN_ROW) && !sameColor(first, ODD_ROW);
}

function normalizeBackground(color: SheetBackground | null | undefined): {
  red: number;
  green: number;
  blue: number;
} {
  if (color == null) {
    return EVEN_ROW;
  }

  return {
    red: color.red ?? 0,
    green: color.green ?? 0,
    blue: color.blue ?? 0,
  };
}

function sameColor(
  left: { red: number; green: number; blue: number },
  right: { red: number; green: number; blue: number },
): boolean {
  return (
    colorChannel(left.red) === colorChannel(right.red) &&
    colorChannel(left.green) === colorChannel(right.green) &&
    colorChannel(left.blue) === colorChannel(right.blue)
  );
}

function colorChannel(value: number): number {
  return Math.round(value * 255);
}

function copyPaste(
  plan: ApplicationWritePlan,
  pasteType: 'PASTE_FORMAT' | 'PASTE_DATA_VALIDATION' | 'PASTE_FORMULA',
  startColumnIndex: number,
  endColumnIndex: number,
): object {
  const source = plan.referenceIndex ?? plan.destinationIndex;

  return {
    copyPaste: {
      source: gridRange(plan.sheetId, source, startColumnIndex, endColumnIndex),
      destination: gridRange(
        plan.sheetId,
        plan.destinationIndex,
        startColumnIndex,
        endColumnIndex,
      ),
      pasteType,
    },
  };
}

function gridRange(
  sheetId: number,
  rowIndex: number,
  startColumnIndex: number,
  endColumnIndex: number,
): object {
  return {
    sheetId,
    startRowIndex: rowIndex,
    endRowIndex: rowIndex + 1,
    startColumnIndex,
    endColumnIndex,
  };
}

function contiguous(cells: readonly ApplicationCell[]): ApplicationCell[][] {
  const sorted = [...cells].sort((left, right) => left.column - right.column);
  const groups: ApplicationCell[][] = [];

  for (const cell of sorted) {
    const group = groups[groups.length - 1];
    const previous = group?.[group.length - 1];

    if (
      group == null ||
      previous == null ||
      cell.column !== previous.column + 1
    ) {
      groups.push([cell]);
    } else {
      group.push(cell);
    }
  }

  return groups;
}

function valueUpdate(
  plan: ApplicationWritePlan,
  cells: ApplicationCell[],
): object {
  const start = cells[0]?.column ?? 0;
  const end = (cells[cells.length - 1]?.column ?? start) + 1;

  return {
    updateCells: {
      range: gridRange(plan.sheetId, plan.destinationIndex, start, end),
      rows: [{ values: cells.map(enteredValue) }],
      fields: 'userEnteredValue',
    },
  };
}

function dateUpdate(plan: ApplicationWritePlan, serial: number): object {
  return {
    updateCells: {
      range: gridRange(plan.sheetId, plan.destinationIndex, 7, 8),
      rows: [
        {
          values: [
            {
              userEnteredValue: { numberValue: serial },
              userEnteredFormat: {
                numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' },
              },
            },
          ],
        },
      ],
      fields: 'userEnteredValue,userEnteredFormat.numberFormat',
    },
  };
}

function rowBackground(sheetId: number, gridIndex: number): object {
  const sheetRow = gridIndex + 1;

  return {
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: gridIndex,
        endRowIndex: gridIndex + 1,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: sheetRow % 2 === 0 ? EVEN_ROW : ODD_ROW,
        },
      },
      fields: 'userEnteredFormat.backgroundColor',
    },
  };
}

function linkTextColor(plan: ApplicationWritePlan): object {
  return {
    repeatCell: {
      range: gridRange(
        plan.sheetId,
        plan.destinationIndex,
        LINK_COLUMN,
        LINK_COLUMN + 1,
      ),
      cell: {
        userEnteredFormat: {
          textFormat: { foregroundColor: LINK_TEXT },
        },
      },
      fields: 'userEnteredFormat.textFormat.foregroundColor',
    },
  };
}

function sheetColor(hex: string): { red: number; green: number; blue: number } {
  const value = Number.parseInt(hex.slice(1), 16);

  return {
    red: ((value >> 16) & 255) / 255,
    green: ((value >> 8) & 255) / 255,
    blue: (value & 255) / 255,
  };
}

function enteredValue(cell: ApplicationCell): object {
  if ('stringValue' in cell) {
    return { userEnteredValue: { stringValue: cell.stringValue } };
  }

  return { userEnteredValue: { numberValue: cell.numberValue } };
}
