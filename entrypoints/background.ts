import { createContainer } from '@/src/composition/create-container';
import { readJobBoardBadgeMessage } from '@/src/domain/job-offer/job-board-badge';
import { logVerify } from '@/src/infrastructure/logging/verify-log';
import { isRecognizedJobBoardUrl } from '@/src/infrastructure/platforms/supported-hosts';
import { paintJobBoardBadge } from '@/src/presentation/badge/paint-job-board-badge';
import { handleSpreadsheetMessage } from '@/src/presentation/messaging/handle-spreadsheet-message';

export default defineBackground(() => {
  const container = createContainer();

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const badge = readJobBoardBadgeMessage(message);

    if (badge != null) {
      const tabId = sender.tab?.id;
      const url = sender.tab?.url ?? '';

      if (tabId == null) {
        sendResponse({ status: 'ignored' });
        return true;
      }

      const text = url !== '' && !isRecognizedJobBoardUrl(url) ? '' : badge;

      void paintJobBoardBadge(browser.action, tabId, text)
        .then(() => {
          sendResponse({ status: 'ok' });
        })
        .catch((error: unknown) => {
          logVerify('badge.error', error);
          sendResponse({ status: 'unavailable' });
        });

      return true;
    }

    void handleSpreadsheetMessage(message, container)
      .then(sendResponse)
      .catch((error: unknown) => {
        logVerify('message.error', error);
        sendResponse({
          status: 'unavailable',
          detail: error instanceof Error ? error.message : String(error),
        });
      });

    return true;
  });
});
