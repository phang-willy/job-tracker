export function isLinkedInUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'www.linkedin.com';
  } catch {
    return false;
  }
}

export function isJobsTrackerPage(url: string): boolean {
  try {
    const parsed = new URL(url);

    return (
      parsed.hostname === 'www.linkedin.com' &&
      (parsed.pathname === '/jobs-tracker' ||
        parsed.pathname.startsWith('/jobs-tracker/'))
    );
  } catch {
    return false;
  }
}

export function isAppliedJobsTrackerPage(url: string): boolean {
  try {
    const parsed = new URL(url);

    return (
      isJobsTrackerPage(url) && parsed.searchParams.get('stage') === 'applied'
    );
  } catch {
    return false;
  }
}

export function isLinkedInJobViewPage(url: string): boolean {
  try {
    const parsed = new URL(url);

    return (
      parsed.hostname === 'www.linkedin.com' &&
      /^\/jobs\/view\/[^/]+\/?$/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}
