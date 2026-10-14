import { describe, expect, it } from 'vitest';
import { describeActiveTab } from '@/src/presentation/shared/active-tab';

describe('describeActiveTab', () => {
  it('describes the active tab from its title and hostname', () => {
    expect(
      describeActiveTab({
        title: 'Offre LinkedIn',
        url: 'https://www.linkedin.com/jobs/view/123',
      }),
    ).toEqual({
      title: 'Offre LinkedIn',
      location: 'www.linkedin.com',
    });
  });

  it('uses a fallback title when the tab has none', () => {
    expect(describeActiveTab({ title: '   ', url: 'not a url' })).toEqual({
      title: 'Sans titre',
      location: '',
    });
  });

  it('reports that no tab is active', () => {
    expect(describeActiveTab(undefined)).toEqual({
      title: 'Aucun onglet actif',
      location: '',
    });
  });
});
