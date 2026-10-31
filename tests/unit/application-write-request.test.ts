import { describe, expect, it } from 'vitest';
import { applicationWriteRequests } from '@/src/infrastructure/google/application-write-request';

describe('application row colors', () => {
  it('paints an even sheet row white and the link blue', () => {
    const colors = rowColors(183);

    expect(colors.background).toEqual(sheetColor('#ffffff'));
    expect(colors.link).toEqual(sheetColor('#4285f4'));
    expect(colors.backgroundRange).toEqual({
      sheetId: 7,
      startRowIndex: 183,
      endRowIndex: 184,
    });
    expect(colors.linkRange).toMatchObject({
      startColumnIndex: 13,
      endColumnIndex: 14,
    });
  });

  it('paints an odd sheet row with the zebra gray', () => {
    expect(rowColors(184).background).toEqual(sheetColor('#f6f8f9'));
  });
});

function rowColors(destinationIndex: number): {
  background: { red: number; green: number; blue: number };
  link: { red: number; green: number; blue: number };
  backgroundRange: object;
  linkRange: object;
} {
  const requests = applicationWriteRequests({
    sheetId: 7,
    destinationIndex,
    insertRow: false,
    referenceIndex: null,
    copyFormula: false,
    cells: [],
  });
  const background = requests.find((request) => {
    const repeat = repeatCell(request);

    return repeat?.fields === 'userEnteredFormat.backgroundColor';
  });
  const link = requests.find((request) => {
    const repeat = repeatCell(request);

    return repeat?.fields === 'userEnteredFormat.textFormat.foregroundColor';
  });
  const backgroundCell = repeatCell(background);
  const linkCell = repeatCell(link);

  return {
    background: backgroundCell?.cell.userEnteredFormat.backgroundColor ?? {
      red: -1,
      green: -1,
      blue: -1,
    },
    link: linkCell?.cell.userEnteredFormat.textFormat?.foregroundColor ?? {
      red: -1,
      green: -1,
      blue: -1,
    },
    backgroundRange: backgroundCell?.range ?? {},
    linkRange: linkCell?.range ?? {},
  };
}

function repeatCell(request: object | undefined):
  | {
      range: object;
      fields: string;
      cell: {
        userEnteredFormat: {
          backgroundColor?: { red: number; green: number; blue: number };
          textFormat?: {
            foregroundColor?: { red: number; green: number; blue: number };
          };
        };
      };
    }
  | undefined {
  if (request == null || !('repeatCell' in request)) {
    return undefined;
  }

  return request.repeatCell as {
    range: object;
    fields: string;
    cell: {
      userEnteredFormat: {
        backgroundColor?: { red: number; green: number; blue: number };
        textFormat?: {
          foregroundColor?: { red: number; green: number; blue: number };
        };
      };
    };
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
