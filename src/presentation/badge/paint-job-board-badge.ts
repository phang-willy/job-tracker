import {
  JOB_BOARD_BADGE_BACKGROUND,
  JOB_BOARD_BADGE_TEXT_COLOR,
} from '@/src/domain/job-offer/job-board-badge';

type BadgeAction = {
  setBadgeText(details: { text: string; tabId: number }): Promise<void> | void;
  setBadgeBackgroundColor(details: {
    color: string;
    tabId: number;
  }): Promise<void> | void;
  setBadgeTextColor(details: {
    color: string;
    tabId: number;
  }): Promise<void> | void;
};

export async function paintJobBoardBadge(
  action: BadgeAction,
  tabId: number,
  text: string,
): Promise<void> {
  if (text !== '') {
    await action.setBadgeBackgroundColor({
      color: JOB_BOARD_BADGE_BACKGROUND,
      tabId,
    });
    await action.setBadgeTextColor({
      color: JOB_BOARD_BADGE_TEXT_COLOR,
      tabId,
    });
  }

  await action.setBadgeText({ text, tabId });
}
