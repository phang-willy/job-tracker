export const JOB_BOARD_BADGE_BACKGROUND = '#1e6e43';
export const JOB_BOARD_BADGE_TEXT_COLOR = '#ffffff';

export type JobBoardBadgeNotice = {
  scope: 'offer' | 'tracker';
  text: string;
};

export function offerPageBadge(input: {
  applied: boolean;
  sheet: 'ok' | 'problem';
  saved: boolean;
}): string {
  if (!input.applied) {
    return 'i';
  }

  if (input.sheet === 'problem') {
    return '!';
  }

  if (!input.saved) {
    return 'X';
  }

  return '✓';
}

export function trackerPageBadge(input: {
  sheet: 'ok' | 'problem';
  jobUrls: readonly string[];
  savedUrls: readonly string[];
}): string {
  if (input.sheet === 'problem') {
    return '!';
  }

  const jobs = [...new Set(input.jobUrls)];

  if (jobs.length === 0) {
    return '';
  }

  const saved = new Set(input.savedUrls);
  const missing = jobs.filter((url) => !saved.has(url)).length;

  return missing === 0 ? '✓' : String(missing);
}

export function isJobBoardBadgeText(text: string): boolean {
  return (
    text === '' ||
    text === '!' ||
    text === 'i' ||
    text === 'X' ||
    text === '✓' ||
    /^\d{1,3}$/.test(text)
  );
}

export function readJobBoardBadgeMessage(message: unknown): string | null {
  if (message == null || typeof message !== 'object') {
    return null;
  }

  const record = message as { type?: unknown; text?: unknown };

  if (
    record.type !== 'set-job-board-badge' ||
    typeof record.text !== 'string' ||
    !isJobBoardBadgeText(record.text)
  ) {
    return null;
  }

  return record.text;
}
