import { describe, expect, it } from 'vitest';
import {
  canonicalLinkedInJobUrl,
  isUnappliedLinkedInSearchUrl,
  linkedinJobIdFromUrl,
} from '@/src/domain/job-offer/normalizers/linkedin-url';

describe('canonicalLinkedInJobUrl', () => {
  it('prefers the offer id over tracking parameters and a stale query id', () => {
    expect(
      canonicalLinkedInJobUrl(
        'https://www.linkedin.com/jobs/search/?currentJobId=111&trackingId=abc',
        '4475859401',
      ),
    ).toBe('https://www.linkedin.com/jobs/view/4475859401/');
  });

  it('reads the id from a view url or from currentJobId', () => {
    expect(
      linkedinJobIdFromUrl(
        'https://www.linkedin.com/jobs/view/web-developer-at-novaspace-4475859401/?trk=public',
      ),
    ).toBe('4475859401');
    expect(
      canonicalLinkedInJobUrl(
        'https://www.linkedin.com/jobs/search/?currentJobId=4475859401',
        null,
      ),
    ).toBe('https://www.linkedin.com/jobs/view/4475859401/');
    expect(
      canonicalLinkedInJobUrl(
        'https://www.linkedin.com/jobs/view/4475859401/?trackingId=abc',
        null,
      ),
    ).toBe('https://www.linkedin.com/jobs/view/4475859401/');
  });

  it('normalizes a search results url and drops tracking parameters', () => {
    expect(
      canonicalLinkedInJobUrl(
        'https://www.linkedin.com/jobs/search-results/?currentJobId=4479874662&trackingId=abc',
        null,
      ),
    ).toBe('https://www.linkedin.com/jobs/view/4479874662/');
    expect(
      canonicalLinkedInJobUrl(
        'https://www.linkedin.com/jobs/view/4475859401/',
        null,
      ),
    ).toBe('https://www.linkedin.com/jobs/view/4475859401/');
  });

  it('does not invent a link when the identifiers disagree or are missing', () => {
    expect(
      canonicalLinkedInJobUrl(
        'https://www.linkedin.com/jobs/view/111/?currentJobId=222',
        null,
      ),
    ).toBe('');
    expect(
      canonicalLinkedInJobUrl(
        'https://www.linkedin.com/jobs/search-results/?currentJobId=4475859401',
        'abc',
      ),
    ).toBe('');
    expect(
      canonicalLinkedInJobUrl(
        'https://www.linkedin.com/jobs/search-results/',
        null,
      ),
    ).toBe('');
  });

  it('treats a search results page with currentJobId as an unsent application', () => {
    expect(
      isUnappliedLinkedInSearchUrl(
        'https://www.linkedin.com/jobs/search-results/?currentJobId=4479874662&trackingId=abc',
      ),
    ).toBe(true);
    expect(
      isUnappliedLinkedInSearchUrl(
        'https://www.linkedin.com/jobs/search-results/',
      ),
    ).toBe(false);
    expect(
      isUnappliedLinkedInSearchUrl(
        'https://www.linkedin.com/jobs/search/?currentJobId=4479874662',
      ),
    ).toBe(false);
    expect(
      isUnappliedLinkedInSearchUrl(
        'https://www.linkedin.com/jobs/view/4479874662/',
      ),
    ).toBe(false);
  });

  it('does not keep a LinkedIn page that is not a job offer', () => {
    expect(
      canonicalLinkedInJobUrl('https://www.linkedin.com/feed/', null),
    ).toBe('');
  });
});
