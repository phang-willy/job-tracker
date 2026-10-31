import { collapseWhitespace, fold } from '@/src/domain/shared/text';

export type JobLocation = {
  city: string;
  region: string;
  country: string;
};

const COUNTRY_CODES: Record<string, string> = {
  AT: 'Autriche',
  AU: 'Australie',
  BE: 'Belgique',
  CA: 'Canada',
  CH: 'Suisse',
  CI: "Côte d'Ivoire",
  DE: 'Allemagne',
  DK: 'Danemark',
  DZ: 'Algérie',
  ES: 'Espagne',
  FI: 'Finlande',
  FR: 'France',
  GB: 'Royaume-Uni',
  IE: 'Irlande',
  IT: 'Italie',
  LT: 'Lituanie',
  LU: 'Luxembourg',
  MA: 'Maroc',
  NL: 'Pays-Bas',
  NO: 'Norvège',
  PL: 'Pologne',
  PT: 'Portugal',
  SE: 'Suède',
  SN: 'Sénégal',
  TN: 'Tunisie',
  UK: 'Royaume-Uni',
  US: 'États-Unis',
};

const COUNTRY_NAMES = [
  'France',
  'Allemagne',
  'Germany',
  'Espagne',
  'Spain',
  'Italie',
  'Italy',
  'Belgique',
  'Belgium',
  'Suisse',
  'Switzerland',
  'Pays-Bas',
  'Netherlands',
  'Portugal',
  'Luxembourg',
  'Lituanie',
  'Lithuania',
  'Irlande',
  'Ireland',
  'Grèce',
  'Greece',
  'Autriche',
  'Austria',
  'Pologne',
  'Poland',
  'Suède',
  'Sweden',
  'Danemark',
  'Denmark',
  'Norvège',
  'Norway',
  'Finlande',
  'Finland',
  'Australie',
  'Australia',
  'Inde',
  'India',
  'Brésil',
  'Brazil',
  'Mexique',
  'Mexico',
  'Maroc',
  'Morocco',
  'Tunisie',
  'Tunisia',
  'Sénégal',
  'Senegal',
  "Côte d'Ivoire",
  'Algérie',
  'Algeria',
  'Chine',
  'China',
  'Japon',
  'Japan',
  'Singapour',
  'Singapore',
  'Émirats arabes unis',
  'United Arab Emirates',
  'Canada',
  'Royaume-Uni',
  'United Kingdom',
  'États-Unis',
  'United States',
];

const REGION_NAMES = [
  'Île-de-France',
  'Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté',
  'Bretagne',
  'Centre-Val de Loire',
  'Corse',
  'Grand Est',
  'Hauts-de-France',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  "Provence-Alpes-Côte d'Azur",
  'England',
  'Scotland',
  'Wales',
  'Northern Ireland',
  'Ontario',
  'Québec',
  'British Columbia',
  'Colombie-Britannique',
  'Alberta',
  'Manitoba',
  'Saskatchewan',
  'Nova Scotia',
  'Nouvelle-Écosse',
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
  'District of Columbia',
];

const WORKPLACES = new Set([
  'hybride',
  'hybrid',
  'sursite',
  'onsite',
  'teletravail',
  'remote',
  'adistance',
  'workfromhome',
  'presentiel',
]);

const REMOTE_WORKPLACES = new Set([
  'adistance',
  'remote',
  'teletravail',
  'workfromhome',
]);

const AMBIGUOUS_PLACES = new Set([
  'monde',
  'worldwide',
  'global',
  'emea',
  'europe',
  'unioneuropeenne',
  'plusieurslieux',
  'multiplelocations',
  'variouslocations',
  'international',
  'anywhere',
  'nimporteou',
]);

const CONTRACT_TOKENS = new Set([
  'tempsplein',
  'tempspartiel',
  'fulltime',
  'parttime',
  'cdi',
  'cdd',
  'stage',
  'stagiaire',
  'internship',
  'intern',
  'alternance',
  'apprentissage',
  'apprenti',
  'vie',
  'freelance',
  'interim',
  'interimaire',
]);

const PROMOTED = new Set([
  'promu',
  'promue',
  'promoted',
  'sponsorise',
  'sponsorisee',
  'sponsored',
]);

const METRO_CITIES = new Map<string, { city: string; country: string }>([
  ['brussels', { city: 'Bruxelles', country: 'Belgique' }],
  ['bruxelles', { city: 'Bruxelles', country: 'Belgique' }],
  ['antwerp', { city: 'Anvers', country: 'Belgique' }],
  ['anvers', { city: 'Anvers', country: 'Belgique' }],
  ['ghent', { city: 'Gand', country: 'Belgique' }],
  ['gand', { city: 'Gand', country: 'Belgique' }],
  ['liege', { city: 'Liège', country: 'Belgique' }],
  ['paris', { city: 'Paris', country: 'France' }],
  ['lyon', { city: 'Lyon', country: 'France' }],
  ['lille', { city: 'Lille', country: 'France' }],
  ['marseille', { city: 'Marseille', country: 'France' }],
  ['toulouse', { city: 'Toulouse', country: 'France' }],
  ['bordeaux', { city: 'Bordeaux', country: 'France' }],
  ['nantes', { city: 'Nantes', country: 'France' }],
  ['amsterdam', { city: 'Amsterdam', country: 'Pays-Bas' }],
  ['rotterdam', { city: 'Rotterdam', country: 'Pays-Bas' }],
  ['london', { city: 'London', country: 'Royaume-Uni' }],
  ['berlin', { city: 'Berlin', country: 'Allemagne' }],
  ['munich', { city: 'Munich', country: 'Allemagne' }],
  ['madrid', { city: 'Madrid', country: 'Espagne' }],
  ['barcelona', { city: 'Barcelone', country: 'Espagne' }],
  ['barcelone', { city: 'Barcelone', country: 'Espagne' }],
]);

const METRO_AREA =
  /^(?:greater\s+)?(.+?)\s+(?:metropolitan area|metro area|et p[eé]riph[eé]rie|and periphery|area)$/i;

const countries = keysOf(COUNTRY_NAMES);
const regions = keysOf(REGION_NAMES);

export function parseJobLocation(raw: string): JobLocation {
  const cleaned = collapseWhitespace(
    collapseWhitespace(raw).replace(
      /\s*\((?:hybride|hybrid|remote|télétravail|teletravail|sur site|on-site|temps plein|temps partiel|full-time|part-time)\)\s*/gi,
      ' ',
    ),
  );

  if (cleaned === '') {
    return emptyLocation();
  }

  const places = cleaned
    .split(/\s*(?:·|•|\|)\s*|\s+\/\s+/)
    .map((part) => collapseWhitespace(part))
    .filter((part) => part !== '' && !isIgnorableLocationPart(part));

  const only = places[0];

  if (only === undefined || places.length !== 1) {
    return emptyLocation();
  }

  return parseSingleLocation(only);
}

export function chooseJobLocation(
  candidates: readonly string[],
  excluded: readonly string[],
): JobLocation {
  const skipped = new Set(excluded.filter((value) => value !== ''));

  for (const candidate of candidates) {
    if (skipped.has(candidate)) {
      continue;
    }

    const parsed = parseJobLocation(candidate);

    if (parsed.city === '' && parsed.country === '') {
      continue;
    }

    if (parsed.country === '' && skipped.has(parsed.city)) {
      continue;
    }

    return parsed;
  }

  return emptyLocation();
}

export function applyRemoteCity(
  location: JobLocation,
  labels: readonly string[],
): JobLocation {
  if (
    location.city !== '' ||
    location.region !== '' ||
    location.country === '' ||
    !labels.some((label) => REMOTE_WORKPLACES.has(placeKey(label)))
  ) {
    return location;
  }

  return { ...location, city: 'Remote' };
}

function parseSingleLocation(value: string): JobLocation {
  const metro = parseMetroArea(value);

  if (metro !== null) {
    return metro;
  }

  if (/ et /.test(value)) {
    return emptyLocation();
  }

  const segments = value
    .split(',')
    .map((segment) => collapseWhitespace(segment))
    .filter((segment) => segment !== '');

  if (segments.length === 1) {
    return singleSegment(segments[0] ?? '');
  }

  if (segments.length === 2) {
    return twoSegments(segments[0] ?? '', segments[1] ?? '');
  }

  const country = segments[segments.length - 1] ?? '';

  if (!isCountry(country) && !isCountryCode(country)) {
    return emptyLocation();
  }

  return {
    city: segments[0] ?? '',
    region: segments.slice(1, -1).join(', '),
    country: displayCountry(country),
  };
}

function parseMetroArea(value: string): JobLocation | null {
  const match = METRO_AREA.exec(value);

  if (match === null) {
    return null;
  }

  const known = METRO_CITIES.get(placeKey(match[1] ?? ''));

  if (known === undefined) {
    return emptyLocation();
  }

  return { city: known.city, region: '', country: known.country };
}

function singleSegment(value: string): JobLocation {
  return { city: '', region: '', country: displayCountry(value) };
}

function twoSegments(first: string, second: string): JobLocation {
  if (isCountry(second) || isCountryCode(second)) {
    return {
      city: isRegion(first) ? '' : first,
      region: isRegion(first) ? first : '',
      country: displayCountry(second),
    };
  }

  if (isRegion(second)) {
    return { city: first, region: second, country: '' };
  }

  return emptyLocation();
}

function isIgnorableLocationPart(value: string): boolean {
  return (
    isAge(value) ||
    isApplicants(value) ||
    isPromoted(value) ||
    isWorkplace(value) ||
    isAmbiguousPlace(value) ||
    CONTRACT_TOKENS.has(placeKey(value))
  );
}

export function isRecognizedPlace(value: string): boolean {
  const parsed = parseJobLocation(value);

  return (
    (parsed.country !== '' && isCountry(parsed.country)) ||
    (parsed.region !== '' && isRegion(parsed.region))
  );
}

function isCountry(value: string): boolean {
  return countries.has(placeKey(value));
}

function isCountryCode(value: string): boolean {
  return (
    /^[A-Za-z]{2}$/.test(value) &&
    COUNTRY_CODES[value.toUpperCase()] !== undefined
  );
}

function isRegion(value: string): boolean {
  return regions.has(placeKey(value));
}

function isWorkplace(value: string): boolean {
  return WORKPLACES.has(placeKey(value));
}

function isAmbiguousPlace(value: string): boolean {
  return AMBIGUOUS_PLACES.has(placeKey(value));
}

function isPromoted(value: string): boolean {
  return PROMOTED.has(placeKey(value));
}

function isAge(value: string): boolean {
  const text = fold(value);

  return (
    text.startsWith('il y a') ||
    text.endsWith('ago') ||
    text.startsWith('reposted') ||
    text.startsWith('republi') ||
    /^(aujourd'hui|hier|today|yesterday)$/.test(text) ||
    /^\d+\s+(minute|minutes|heure|heures|jour|jours|semaine|semaines|mois|an|ans|hour|hours|day|days|week|weeks|month|months|year|years)\b/.test(
      text,
    )
  );
}

function isApplicants(value: string): boolean {
  return /candidat|applicant|people clicked|ont clique|ont postul/.test(
    fold(value),
  );
}

function displayCountry(segment: string): string {
  if (/^[A-Za-z]{2}$/.test(segment)) {
    return COUNTRY_CODES[segment.toUpperCase()] ?? segment;
  }

  return segment;
}

function placeKey(value: string): string {
  return fold(value).replace(/[^a-z]/g, '');
}

function keysOf(names: readonly string[]): Set<string> {
  return new Set(names.map((name) => placeKey(name)));
}

function emptyLocation(): JobLocation {
  return { city: '', region: '', country: '' };
}
