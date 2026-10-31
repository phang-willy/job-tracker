import { describe, expect, it } from 'vitest';
import { normalizeContract } from '@/src/domain/job-offer/contract';

describe('normalizeContract', () => {
  it('maps Temps plein to a proposed CDI', () => {
    expect(normalizeContract(['Hybride', 'Temps plein'])).toEqual({
      contractType: 'CDI',
      inferredFromFullTime: true,
    });
  });

  it('maps the English full-time label the same way', () => {
    expect(normalizeContract(['Full-time'])).toEqual({
      contractType: 'CDI',
      inferredFromFullTime: true,
    });
  });

  it('keeps an explicit contract ahead of Temps plein', () => {
    expect(normalizeContract(['Temps plein', 'CDD'])).toEqual({
      contractType: 'CDD',
      inferredFromFullTime: false,
    });
    expect(normalizeContract(['CDI', 'Temps plein'])).toEqual({
      contractType: 'CDI',
      inferredFromFullTime: false,
    });
  });

  it('recognizes the other explicit contract labels', () => {
    expect(normalizeContract(['Stage']).contractType).toBe('Stage');
    expect(normalizeContract(['Alternance']).contractType).toBe('Alternance');
    expect(normalizeContract(['Apprentissage']).contractType).toBe(
      'Alternance',
    );
    expect(normalizeContract(['VIE']).contractType).toBe('VIE');
    expect(normalizeContract(['Freelance']).contractType).toBe('Freelance');
    expect(normalizeContract(['Intérim']).contractType).toBe('Intérim');
  });

  it('leaves the contract empty when LinkedIn only shows a workplace or part-time', () => {
    expect(normalizeContract(['Hybride'])).toEqual({
      contractType: '',
      inferredFromFullTime: false,
    });
    expect(normalizeContract(['Temps partiel'])).toEqual({
      contractType: '',
      inferredFromFullTime: false,
    });
    expect(normalizeContract([])).toEqual({
      contractType: '',
      inferredFromFullTime: false,
    });
  });
});
