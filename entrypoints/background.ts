import { createContainer } from '@/src/composition/create-container';
import { logVerify } from '@/src/infrastructure/logging/verify-log';
import { handleSpreadsheetMessage } from '@/src/presentation/messaging/handle-spreadsheet-message';

export default defineBackground(() => {
  const container = createContainer();

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
