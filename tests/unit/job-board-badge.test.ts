import { describe, expect, it } from 'vitest';
import {
  isJobBoardBadgeText,
  offerPageBadge,
  readJobBoardBadgeMessage,
  trackerPageBadge,
} from '@/src/domain/job-offer/job-board-badge';
import { isRecognizedJobBoardUrl } from '@/src/infrastructure/platforms/supported-hosts';

describe('job board badge', () => {
  it('uses an info mark when the offer was not sent', () => {
    expect(offerPageBadge({ applied: false, sheet: 'ok', saved: false })).toBe(
      'i',
    );
    expect(
      offerPageBadge({ applied: false, sheet: 'problem', saved: false }),
    ).toBe('i');
  });

  it('uses an exclamation when an applied offer cannot be checked', () => {
    expect(
      offerPageBadge({ applied: true, sheet: 'problem', saved: false }),
    ).toBe('!');
  });

  it('uses a cross when the offer was sent but is absent from the sheet', () => {
    expect(offerPageBadge({ applied: true, sheet: 'ok', saved: false })).toBe(
      'X',
    );
  });

  it('uses a check when the offer is saved', () => {
    expect(offerPageBadge({ applied: true, sheet: 'ok', saved: true })).toBe(
      '✓',
    );
  });

  it('counts the unsynced jobs on the applied tracker page', () => {
    expect(
      trackerPageBadge({
        sheet: 'ok',
        jobUrls: [
          'https://www.linkedin.com/jobs/view/1/',
          'https://www.linkedin.com/jobs/view/1/',
          'https://www.linkedin.com/jobs/view/2/',
        ],
        savedUrls: ['https://www.linkedin.com/jobs/view/1/'],
      }),
    ).toBe('1');
  });

  it('uses a check when every visible applied job is saved', () => {
    expect(
      trackerPageBadge({
        sheet: 'ok',
        jobUrls: ['https://www.linkedin.com/jobs/view/1/'],
        savedUrls: ['https://www.linkedin.com/jobs/view/1/'],
      }),
    ).toBe('✓');
  });

  it('uses an exclamation when the tracker cannot read the sheet', () => {
    expect(
      trackerPageBadge({
        sheet: 'problem',
        jobUrls: ['https://www.linkedin.com/jobs/view/1/'],
        savedUrls: [],
      }),
    ).toBe('!');
  });

  it('stays empty when the tracker page has no rows yet', () => {
    expect(trackerPageBadge({ sheet: 'ok', jobUrls: [], savedUrls: [] })).toBe(
      '',
    );
  });

  it('accepts only the badge symbols', () => {
    expect(
      readJobBoardBadgeMessage({ type: 'set-job-board-badge', text: 'i' }),
    ).toBe('i');
    expect(
      readJobBoardBadgeMessage({ type: 'set-job-board-badge', text: 'nope' }),
    ).toBeNull();
    expect(isJobBoardBadgeText('12')).toBe(true);
  });
});

describe('recognized job boards', () => {
  it('recognizes LinkedIn, Indeed, HelloWork and Welcome to the Jungle', () => {
    expect(
      isRecognizedJobBoardUrl('https://www.linkedin.com/jobs/view/4469017934/'),
    ).toBe(true);
    expect(
      isRecognizedJobBoardUrl(
        'https://www.linkedin.com/jobs-tracker/?stage=applied',
      ),
    ).toBe(true);
    expect(
      isRecognizedJobBoardUrl('https://fr.indeed.com/viewjob?jk=abc'),
    ).toBe(true);
    expect(
      isRecognizedJobBoardUrl('https://www.hellowork.com/emplois/1.html'),
    ).toBe(true);
    expect(
      isRecognizedJobBoardUrl(
        'https://www.welcometothejungle.com/fr/companies',
      ),
    ).toBe(true);
    expect(isRecognizedJobBoardUrl('https://example.com/')).toBe(false);
  });
});
