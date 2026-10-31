import { describe, expect, it } from 'vitest';
import {
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
