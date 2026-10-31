import { describe, expect, it } from 'vitest';
import { estimateSalary } from '@/src/domain/job-offer/salary';

describe('estimateSalary', () => {
  it('averages a yearly range into a monthly salary and an annual total', () => {
    expect(
      estimateSalary(['55K\u00a0€\u00a0par yr - 60K\u00a0€\u00a0par yr']),
    ).toEqual({
      monthlySalary: '4792',
      annualSalary: '57504',
    });
  });

  it('keeps a single yearly amount', () => {
    expect(estimateSalary(['48K € par an'])).toEqual({
      monthlySalary: '4000',
      annualSalary: '48000',
    });
  });

  it('turns one monthly amount into the annual salary', () => {
    expect(estimateSalary(['3 500 € par mois'])).toEqual({
      monthlySalary: '3500',
      annualSalary: '42000',
    });
  });

  it('averages every amount when several pills are present', () => {
    expect(estimateSalary(['50K € par an', '60K € par an'])).toEqual({
      monthlySalary: '4583',
      annualSalary: '54996',
    });
  });

  it('stays empty without a euro amount or a pay period', () => {
    expect(estimateSalary(['Temps plein', '4 500 €', ''])).toEqual({
      monthlySalary: '',
      annualSalary: '',
    });
  });
});
