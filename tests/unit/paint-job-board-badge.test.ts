import { describe, expect, it, vi } from 'vitest';
import { paintJobBoardBadge } from '@/src/presentation/badge/paint-job-board-badge';

describe('paintJobBoardBadge', () => {
  it('paints a green badge with white text', async () => {
    const action = {
      setBadgeText: vi.fn(() => Promise.resolve()),
      setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
      setBadgeTextColor: vi.fn(() => Promise.resolve()),
    };

    await paintJobBoardBadge(action, 4, 'X');

    expect(action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#1e6e43',
      tabId: 4,
    });
    expect(action.setBadgeTextColor).toHaveBeenCalledWith({
      color: '#ffffff',
      tabId: 4,
    });
    expect(action.setBadgeText).toHaveBeenCalledWith({ text: 'X', tabId: 4 });
  });

  it('clears the badge without painting a color', async () => {
    const action = {
      setBadgeText: vi.fn(() => Promise.resolve()),
      setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
      setBadgeTextColor: vi.fn(() => Promise.resolve()),
    };

    await paintJobBoardBadge(action, 4, '');

    expect(action.setBadgeText).toHaveBeenCalledWith({ text: '', tabId: 4 });
    expect(action.setBadgeBackgroundColor).not.toHaveBeenCalled();
  });
});
