import { isRecognizedPlace } from '@/src/domain/job-offer/location';
import { collapseWhitespace, fold } from '@/src/domain/shared/text';

export type LinkedInHeading = {
  title: string;
  company: string;
  location: string;
};

const AT_COMPANY_LOCATION = /^(.+?)\s+at\s+(.+?)\s+[—–-]\s+(.+)$/i;

export function parseLinkedInPageTitle(raw: string): LinkedInHeading {
  const cleaned = collapseWhitespace(raw).replace(/^\(\d+\)\s*/, '');
  const parts = cleaned
    .split('|')
    .map((part) => collapseWhitespace(part))
    .filter((part) => part !== '');

  while (parts.length > 0 && isLinkedInSuffix(parts[parts.length - 1] ?? '')) {
    parts.pop();
  }

  const only = parts.length === 1 ? parts[0] : undefined;
  const embedded = only === undefined ? null : AT_COMPANY_LOCATION.exec(only);

  if (embedded !== null) {
    return {
      title: collapseWhitespace(embedded[1] ?? ''),
      company: collapseWhitespace(embedded[2] ?? ''),
      location: collapseWhitespace(embedded[3] ?? ''),
    };
  }

  if (parts.length === 1 && isLocationText(parts[0] ?? '')) {
    return { title: '', company: '', location: parts[0] ?? '' };
  }

  const first = parts[0] ?? '';
  const second = parts[1] ?? '';

  if (first !== '' && second !== '' && isLocationText(first)) {
    return {
      title: second,
      company: parts[2] ?? '',
      location: first,
    };
  }

  return {
    title: first,
    company: second,
    location: '',
  };
}

function isLinkedInSuffix(value: string): boolean {
  return fold(value).startsWith('linkedin');
}

function isLocationText(value: string): boolean {
  return isRecognizedPlace(value);
}
