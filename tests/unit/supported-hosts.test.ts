import { describe, expect, it } from 'vitest';
import {
  extensionHostPermissions,
  jobBoardMatches,
} from '@/src/infrastructure/platforms/supported-hosts';

describe('supported hosts', () => {
  it('covers the four job boards and Google Sheets', () => {
    expect(jobBoardMatches).toEqual([
      'https://www.linkedin.com/*',
      'https://*.indeed.com/*',
      'https://*.indeed.fr/*',
      'https://www.hellowork.com/*',
      'https://www.welcometothejungle.com/*',
    ]);
    expect(extensionHostPermissions).toContain(
      'https://sheets.googleapis.com/*',
    );
  });
});
