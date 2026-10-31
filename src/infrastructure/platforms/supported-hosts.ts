export const jobBoardMatches = [
  'https://www.linkedin.com/*',
  'https://*.indeed.com/*',
  'https://*.indeed.fr/*',
  'https://www.hellowork.com/*',
  'https://www.welcometothejungle.com/*',
] as const;

export const extensionHostPermissions = [
  ...jobBoardMatches,
  'https://sheets.googleapis.com/*',
  'https://www.googleapis.com/drive/*',
] as const;

export function isRecognizedJobBoardUrl(url: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return jobBoardMatches.some((pattern) => urlPatternMatches(parsed, pattern));
}

function urlPatternMatches(url: URL, pattern: string): boolean {
  const match = /^https:\/\/(\*\.)?([^/]+)\/\*$/.exec(pattern);

  if (match == null || url.protocol !== 'https:') {
    return false;
  }

  const wildcard = match[1] != null;
  const host = match[2] ?? '';

  if (wildcard) {
    return url.hostname === host || url.hostname.endsWith(`.${host}`);
  }

  return url.hostname === host;
}
