import type { JobExtractionResult } from '@/src/application/dto/job-offer-messages';
import type {
  ExtractedJobDraft,
  JobOfferExtractor,
} from '@/src/application/ports/job-offer-extractor';
import { normalizeContract } from '@/src/domain/job-offer/contract';
import type { JobOffer } from '@/src/domain/job-offer/job-offer';
import {
  applyRemoteCity,
  chooseJobLocation,
} from '@/src/domain/job-offer/location';
import {
  canonicalLinkedInJobUrl,
  isUnappliedLinkedInSearchUrl,
  linkedinJobIdFromUrl,
} from '@/src/domain/job-offer/normalizers/linkedin-url';
import { parseLinkedInPageTitle } from '@/src/domain/job-offer/page-title';
import { estimateSalary } from '@/src/domain/job-offer/salary';
import { collapseWhitespace } from '@/src/domain/shared/text';

export class ExtractActiveJobOffer {
  constructor(private readonly extractor: JobOfferExtractor) {}

  execute(root: ParentNode, pageUrl: string): JobExtractionResult {
    const extracted = this.extractor.extract(root);
    const draft =
      extracted ??
      (isUnappliedLinkedInSearchUrl(pageUrl)
        ? searchResultsDraft(root, pageUrl)
        : null);

    if (draft === null) {
      return { status: 'not_found' };
    }

    const location = applyRemoteCity(
      chooseJobLocation(draft.locationCandidates, [draft.company, draft.title]),
      draft.contractLabels,
    );
    const contract = normalizeContract(draft.contractLabels);
    const salary = estimateSalary(draft.salaryTexts);
    const offer: JobOffer = {
      company: draft.company,
      title: draft.title,
      city: location.city,
      region: location.region,
      country: location.country,
      contractType: contract.contractType,
      contractInferredFromFullTime: contract.inferredFromFullTime,
      monthlySalary: salary.monthlySalary,
      annualSalary: salary.annualSalary,
      url: canonicalLinkedInJobUrl(
        pageUrl,
        isUnappliedLinkedInSearchUrl(pageUrl)
          ? linkedinJobIdFromUrl(pageUrl)
          : draft.jobId,
      ),
    };
    const status = offerStatus(offer);

    if (status === 'not_found') {
      return { status: 'not_found' };
    }

    return { status, offer };
  }
}

function searchResultsDraft(
  root: ParentNode,
  pageUrl: string,
): ExtractedJobDraft {
  const heading = parseLinkedInPageTitle(pageTitle(root));

  return {
    company: heading.company,
    title: heading.title,
    locationCandidates: heading.location === '' ? [] : [heading.location],
    contractLabels: [],
    salaryTexts: [],
    jobId: linkedinJobIdFromUrl(pageUrl),
  };
}

function pageTitle(root: ParentNode): string {
  const owner = root instanceof Document ? root : root.ownerDocument;

  if (owner === null) {
    return '';
  }

  const fromHead = collapseWhitespace(
    owner.head?.querySelector('title')?.textContent ?? '',
  );

  return fromHead === '' ? collapseWhitespace(owner.title) : fromHead;
}

function offerStatus(offer: JobOffer): 'detected' | 'partial' | 'not_found' {
  const fields = [
    offer.company,
    offer.country,
    offer.city,
    offer.title,
    offer.contractType,
  ];

  if (fields.every((field) => field !== '')) {
    return 'detected';
  }

  if (fields.some((field) => field !== '') || offer.url !== '') {
    return 'partial';
  }

  return 'not_found';
}
