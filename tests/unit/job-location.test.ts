import { describe, expect, it } from 'vitest';
import {
  applyRemoteCity,
  chooseJobLocation,
  parseJobLocation,
} from '@/src/domain/job-offer/location';

describe('parseJobLocation', () => {
  it('reads a city and a country from the usual three LinkedIn segments', () => {
    expect(parseJobLocation('Paris, Île-de-France, France')).toEqual({
      city: 'Paris',
      region: 'Île-de-France',
      country: 'France',
    });
    expect(parseJobLocation('Corbeil-Essonnes, Île-de-France, France')).toEqual(
      {
        city: 'Corbeil-Essonnes',
        region: 'Île-de-France',
        country: 'France',
      },
    );
  });

  it('reads a city and a country from two segments', () => {
    expect(parseJobLocation('Thessaloniki, Central Macedonia, Greece')).toEqual(
      {
        city: 'Thessaloniki',
        region: 'Central Macedonia',
        country: 'Greece',
      },
    );
    expect(parseJobLocation('Vilnius, Lituanie')).toEqual({
      city: 'Vilnius',
      region: '',
      country: 'Lituanie',
    });
    expect(parseJobLocation('Paris, France')).toEqual({
      city: 'Paris',
      region: '',
      country: 'France',
    });
    expect(parseJobLocation('Berlin, Allemagne')).toEqual({
      city: 'Berlin',
      region: '',
      country: 'Allemagne',
    });
  });

  it('treats a single segment as the country', () => {
    expect(parseJobLocation('France')).toEqual({
      city: '',
      region: '',
      country: 'France',
    });
    expect(parseJobLocation('Paris')).toEqual({
      city: '',
      region: '',
      country: 'Paris',
    });
  });

  it('keeps the middle segment as the region', () => {
    expect(parseJobLocation('Île-de-France, France')).toEqual({
      city: '',
      region: 'Île-de-France',
      country: 'France',
    });
    expect(parseJobLocation('Austin, Texas')).toEqual({
      city: 'Austin',
      region: 'Texas',
      country: '',
    });
    expect(parseJobLocation('London, England, United Kingdom')).toEqual({
      city: 'London',
      region: 'England',
      country: 'United Kingdom',
    });
  });

  it('drops the posting age, the workplace and a remote-only label', () => {
    expect(
      parseJobLocation('Paris, Île-de-France, France · il y a 1 semaine'),
    ).toEqual({ city: 'Paris', region: 'Île-de-France', country: 'France' });
    expect(parseJobLocation('Paris, France (Hybride)')).toEqual({
      city: 'Paris',
      region: '',
      country: 'France',
    });
    expect(parseJobLocation('Télétravail')).toEqual({
      city: '',
      region: '',
      country: '',
    });
    expect(parseJobLocation('12 candidats')).toEqual({
      city: '',
      region: '',
      country: '',
    });
  });

  it('reads a metropolitan area as its city and country', () => {
    expect(parseJobLocation('Brussels Metropolitan Area')).toEqual({
      city: 'Bruxelles',
      region: '',
      country: 'Belgique',
    });
    expect(parseJobLocation('Bruxelles et périphérie')).toEqual({
      city: 'Bruxelles',
      region: '',
      country: 'Belgique',
    });
    expect(parseJobLocation('Paris et périphérie')).toEqual({
      city: 'Paris',
      region: '',
      country: 'France',
    });
    expect(parseJobLocation('Greater London Area')).toEqual({
      city: 'London',
      region: '',
      country: 'Royaume-Uni',
    });
    expect(parseJobLocation('Foo Metropolitan Area')).toEqual({
      city: '',
      region: '',
      country: '',
    });
  });

  it('leaves ambiguous locations empty', () => {
    expect(parseJobLocation('Paris, France · Lyon, France')).toEqual({
      city: '',
      region: '',
      country: '',
    });
    expect(parseJobLocation('Paris et Lyon, France')).toEqual({
      city: '',
      region: '',
      country: '',
    });
    expect(parseJobLocation('Europe')).toEqual({
      city: '',
      region: '',
      country: '',
    });
    expect(
      parseJobLocation('Frontend Web Developer - HTML,CSS (Remote)'),
    ).toEqual({
      city: '',
      region: '',
      country: '',
    });
    expect(parseJobLocation('')).toEqual({
      city: '',
      region: '',
      country: '',
    });
  });
});

describe('applyRemoteCity', () => {
  it('fills Remote when the place is only a country and the offer is remote', () => {
    expect(
      applyRemoteCity(parseJobLocation('France'), [
        'À distance',
        'Temps plein',
      ]),
    ).toEqual({ city: 'Remote', region: '', country: 'France' });
    expect(applyRemoteCity(parseJobLocation('France'), ['Remote'])).toEqual({
      city: 'Remote',
      region: '',
      country: 'France',
    });
  });

  it('keeps a known city and ignores a hybrid pill', () => {
    expect(
      applyRemoteCity(parseJobLocation('Paris, France'), ['À distance']),
    ).toEqual({ city: 'Paris', region: '', country: 'France' });
    expect(applyRemoteCity(parseJobLocation('France'), ['Hybride'])).toEqual({
      city: '',
      region: '',
      country: 'France',
    });
    expect(
      applyRemoteCity(parseJobLocation('Île-de-France, France'), [
        'À distance',
      ]),
    ).toEqual({ city: '', region: 'Île-de-France', country: 'France' });
  });
});

describe('chooseJobLocation', () => {
  it('skips the company name and the posting age', () => {
    expect(
      chooseJobLocation(
        ['NovaSpace', 'Web Developer', 'il y a 1 semaine', 'Paris, France'],
        ['NovaSpace', 'Web Developer'],
      ),
    ).toEqual({ city: 'Paris', region: '', country: 'France' });
  });
});
