import type { ActiveJobMessage } from '@/src/application/dto/job-offer-messages';
import type { SiteApplicationStatus } from '@/src/domain/job-offer/application-status';
import type { JobOffer } from '@/src/domain/job-offer/job-offer';

export type ApplicationStatus =
  'loading' | 'detected' | 'partial' | 'unsupported' | 'error';

export type ApplicationView = {
  status: ApplicationStatus;
  offer: JobOffer | null;
  notice: string | null;
  application: SiteApplicationStatus | null;
};

const LOADING_VIEW: ApplicationView = {
  status: 'loading',
  offer: null,
  notice: "Lecture de l'offre…",
  application: null,
};

export function loadingApplicationView(): ApplicationView {
  return LOADING_VIEW;
}

export function hasRecognizedJobLink(view: ApplicationView): boolean {
  return (view.offer?.url ?? '').trim() !== '';
}

export function applicationView(input: {
  page: 'linkedin' | 'other';
  extraction?: ActiveJobMessage | 'unreachable';
}): ApplicationView {
  if (input.page === 'other') {
    return {
      status: 'unsupported',
      offer: null,
      application: null,
      notice: "Cette page n'est pas encore prise en charge.",
    };
  }

  if (input.extraction === undefined || input.extraction === 'unreachable') {
    return {
      status: 'error',
      offer: null,
      application: null,
      notice: "Impossible de lire l'offre sur cette page.",
    };
  }

  if (input.extraction.status === 'error') {
    return {
      status: 'error',
      offer: null,
      application: null,
      notice: "Impossible de lire l'offre sur cette page.",
    };
  }

  if (input.extraction.status === 'not_found') {
    return {
      status: 'unsupported',
      offer: null,
      application: null,
      notice: "Aucune offre LinkedIn n'a été détectée sur cette page.",
    };
  }

  return {
    status: input.extraction.status,
    offer: input.extraction.offer,
    application: input.extraction.application,
    notice:
      input.extraction.status === 'partial'
        ? 'Certaines informations sont manquantes. Tu peux les compléter.'
        : 'Offre détectée',
  };
}
