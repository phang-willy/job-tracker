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
] as const;
