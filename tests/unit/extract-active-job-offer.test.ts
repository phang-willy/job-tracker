import { describe, expect, it } from 'vitest';
import { jobExtractionResultSchema } from '@/src/application/dto/job-offer-messages';
import type { JobOfferExtractor } from '@/src/application/ports/job-offer-extractor';
import { ExtractActiveJobOffer } from '@/src/application/use-cases/extract-active-job-offer';

const pageUrl =
  'https://www.linkedin.com/jobs/search/?currentJobId=111&trackingId=abc';

describe('ExtractActiveJobOffer', () => {
  it('normalizes a full-time offer without calling another service', () => {
    const result = new ExtractActiveJobOffer(
      extractor({
        company: 'NovaSpace',
        title: 'Web Developer',
        locationCandidates: [
          'NovaSpace',
          'il y a 1 semaine',
          'Paris, Île-de-France, France',
        ],
        contractLabels: ['Hybride', 'Temps plein', 'Postuler', 'Enregistré'],
        salaryTexts: ['55K € par yr - 60K € par yr'],
        jobId: '4475859401',
      }),
    ).execute(document, pageUrl);

    expect(result).toEqual({
      status: 'detected',
      offer: {
        company: 'NovaSpace',
        country: 'France',
        region: 'Île-de-France',
        city: 'Paris',
        title: 'Web Developer',
        contractType: 'CDI',
        contractInferredFromFullTime: true,
        monthlySalary: '4792',
        annualSalary: '57504',
        url: 'https://www.linkedin.com/jobs/view/4475859401/',
      },
    });
    expect(jobExtractionResultSchema.safeParse(result).success).toBe(true);
  });

  it('lets an explicit contract replace the full-time proposal', () => {
    const result = new ExtractActiveJobOffer(
      extractor({
        company: 'NovaSpace',
        title: 'Web Developer',
        locationCandidates: ['Paris, France'],
        contractLabels: ['CDD', 'Temps plein'],
        salaryTexts: [],
        jobId: '4475859401',
      }),
    ).execute(document, pageUrl);

    expect(result.status).toBe('detected');
    if (result.status === 'detected') {
      expect(result.offer.contractType).toBe('CDD');
      expect(result.offer.contractInferredFromFullTime).toBe(false);
    }
  });

  it('recognizes a search results page from currentJobId when the offer block is missing', () => {
    document.title = 'Web Developer at NovaSpace - Paris, France | LinkedIn';

    const result = new ExtractActiveJobOffer({
      extract: () => null,
    }).execute(
      document,
      'https://www.linkedin.com/jobs/search-results/?currentJobId=4479874662&trackingId=abc',
    );

    expect(result).toMatchObject({
      status: 'partial',
      offer: {
        company: 'NovaSpace',
        title: 'Web Developer',
        city: 'Paris',
        country: 'France',
        contractType: '',
        url: 'https://www.linkedin.com/jobs/view/4479874662/',
      },
    });
  });

  it('uses currentJobId when the search results block names another offer', () => {
    const result = new ExtractActiveJobOffer(
      extractor({
        company: 'NovaSpace',
        title: 'Web Developer',
        locationCandidates: ['Paris, France'],
        contractLabels: ['CDI'],
        salaryTexts: [],
        jobId: '111',
      }),
    ).execute(
      document,
      'https://www.linkedin.com/jobs/search-results/?currentJobId=4479874662',
    );

    expect(result).toMatchObject({
      status: 'detected',
      offer: { url: 'https://www.linkedin.com/jobs/view/4479874662/' },
    });
  });

  it('returns not_found when the page has no offer', () => {
    const result = new ExtractActiveJobOffer({
      extract: () => null,
    }).execute(document, pageUrl);

    expect(result).toEqual({ status: 'not_found' });
  });
});

function extractor(
  draft: NonNullable<ReturnType<JobOfferExtractor['extract']>>,
): JobOfferExtractor {
  return { extract: () => draft };
}
