import { isUnappliedLinkedInSearchUrl } from '@/src/domain/job-offer/normalizers/linkedin-url';
import { collapseWhitespace, fold } from '@/src/domain/shared/text';

export type SiteApplicationState = 'applied' | 'not_applied' | 'unknown';

export type SiteApplicationStatus = {
  state: SiteApplicationState;
  statusLabel: string;
  relativeDate: string;
};

const UNKNOWN_STATUS: SiteApplicationStatus = {
  state: 'unknown',
  statusLabel: '',
  relativeDate: '',
};

const NOT_APPLIED_STATUS: SiteApplicationStatus = {
  state: 'not_applied',
  statusLabel: '',
  relativeDate: '',
};

export function applicationForLinkedInPage(
  pageUrl: string,
  detected: SiteApplicationStatus,
): SiteApplicationStatus {
  if (isUnappliedLinkedInSearchUrl(pageUrl)) {
    return NOT_APPLIED_STATUS;
  }

  return detected;
}

export function interpretApplicationSignals(input: {
  statusHeading: string;
  statusText: string;
  buttonLabels: readonly string[];
}): SiteApplicationStatus {
  const heading = fold(input.statusHeading);
  const text = collapseWhitespace(input.statusText);
  const relativeDate = readRelativeDate(text);

  if (isStatusDemandHeading(heading)) {
    return {
      state: 'applied',
      statusLabel: 'Candidature envoyée',
      relativeDate,
    };
  }

  const canApply = input.buttonLabels.some((label) => isApplyLabel(label));

  if (canApply) {
    return NOT_APPLIED_STATUS;
  }

  return UNKNOWN_STATUS;
}

export function isStatusDemandHeading(value: string): boolean {
  const heading = fold(value);

  return (
    heading === 'statut de la demande' ||
    heading.startsWith('statut de la demande ') ||
    heading === 'application status' ||
    heading.startsWith('application status ')
  );
}

function isApplyLabel(label: string): boolean {
  const value = fold(label);

  return (
    value === 'postuler' ||
    value.startsWith('postuler ') ||
    value.includes('candidature simplifiee') ||
    value.includes('easy apply')
  );
}

function readRelativeDate(text: string): string {
  const french =
    /il y a(?:\s+environ)?\s+\d+\s+(?:minutes?|heures?|jours?|semaines?|mois|ans?)/i.exec(
      text,
    );

  if (french?.[0] != null) {
    return collapseWhitespace(french[0]);
  }

  const english = /\b\d+\s+(?:minute|hour|day|week|month|year)s?\s+ago\b/i.exec(
    text,
  );

  return english?.[0] == null ? '' : collapseWhitespace(english[0]);
}
