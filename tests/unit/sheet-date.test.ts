import { describe, expect, it } from 'vitest';
import {
  appliedDatesForInsertion,
  civilDateFromSheetSerial,
  sheetSerialFromCivilDate,
} from '@/src/domain/spreadsheet/sheet-date';

describe('sheet serial dates', () => {
  it('uses the spreadsheet epoch so 1970-01-01 stays a real date', () => {
    expect(sheetSerialFromCivilDate('1970-01-01')).toBe(25569);
    expect(civilDateFromSheetSerial(25569)).toBe('1970-01-01');
  });

  it('rejects a calendar day that does not exist', () => {
    expect(sheetSerialFromCivilDate('2026-02-31')).toBeNull();
  });
});

describe('appliedDatesForInsertion', () => {
  it('keeps empty cells and rejects an occupied cell that is not a date', () => {
    expect(
      appliedDatesForInsertion([[46023], [''], ['not a date']]),
    ).toBeNull();
    expect(appliedDatesForInsertion([[46023], ['']])).toEqual(['2026-01-01']);
  });
});
