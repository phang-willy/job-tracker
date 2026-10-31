import { describe, expect, it } from 'vitest';
import { estimateAppliedOn } from '@/src/domain/job-offer/applied-on';

const today = new Date(2026, 9, 15);

describe('estimateAppliedOn', () => {
  it('subtracts a month from today for « il y a 1 mois »', () => {
    expect(estimateAppliedOn('il y a 1 mois', today)).toBe('2026-09-15');
  });

  it('subtracts days, weeks and years', () => {
    expect(estimateAppliedOn('il y a 2 jours', today)).toBe('2026-10-13');
    expect(estimateAppliedOn('il y a 1 semaine', today)).toBe('2026-10-08');
    expect(estimateAppliedOn('il y a 1 an', today)).toBe('2025-10-15');
  });

  it('keeps today for a delay shorter than a day', () => {
    expect(estimateAppliedOn('il y a 3 heures', today)).toBe('2026-10-15');
  });

  it('leaves the date empty when LinkedIn gave no delay', () => {
    expect(estimateAppliedOn('', today)).toBe('');
  });
});
