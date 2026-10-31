const VIEW_ID = /\/jobs\/view\/(?:[^/?#]*?-)?(\d+)\/?$/;

const EMBEDDED_VIEW_ID = /\/jobs\/view\/(?:[^/?#\s"'<>]*?-)?(\d+)/;
const EMBEDDED_CURRENT_JOB_ID = /[?&]currentJobId=(\d+)/;

export function linkedinJobIdInText(value: string): string | null {
  const direct = linkedinJobIdFromUrl(value.trim());

  if (direct !== null) {
    return direct;
  }

  return (
    EMBEDDED_VIEW_ID.exec(value)?.[1] ??
    EMBEDDED_CURRENT_JOB_ID.exec(value)?.[1] ??
    null
  );
}

export function linkedinJobIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value, 'https://www.linkedin.com');
    const currentJobId = url.searchParams.get('currentJobId');
    const queryId =
      currentJobId !== null && /^\d+$/.test(currentJobId) ? currentJobId : null;
    const viewId = VIEW_ID.exec(url.pathname)?.[1] ?? null;

    if (viewId !== null && queryId !== null && viewId !== queryId) {
      return null;
    }

    return viewId ?? queryId;
  } catch {
    return null;
  }
}

const SEARCH_RESULTS_PATH = /^\/jobs\/search-results\/?$/;

export function isUnappliedLinkedInSearchUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.hostname === 'www.linkedin.com' &&
      SEARCH_RESULTS_PATH.test(url.pathname) &&
      linkedinJobIdFromUrl(value) !== null
    );
  } catch {
    return false;
  }
}

export function canonicalLinkedInJobUrl(
  pageUrl: string,
  jobId: string | null,
): string {
  const id = jobId ?? linkedinJobIdFromUrl(pageUrl);

  if (id === null || !/^\d+$/.test(id)) {
    return '';
  }

  return `https://www.linkedin.com/jobs/view/${id}/`;
}
