import type { FindExistingApplication } from '@/src/application/use-cases/find-existing-application';
import type { LinkApplication } from '@/src/application/use-cases/link-application';
import type { ValidateSpreadsheetConfig } from '@/src/application/use-cases/validate-spreadsheet-config';
import type { SpreadsheetSettingsRepository } from '@/src/application/ports/spreadsheet';
import { spreadsheetMessageSchema } from '@/src/application/dto/spreadsheet-messages';
import { logVerify } from '@/src/infrastructure/logging/verify-log';

type SpreadsheetHandlers = {
  validateSpreadsheetConfig: ValidateSpreadsheetConfig;
  findExistingApplication: FindExistingApplication;
  linkApplication: LinkApplication;
  settings: SpreadsheetSettingsRepository;
};

export async function handleSpreadsheetMessage(
  message: unknown,
  handlers: SpreadsheetHandlers,
): Promise<unknown> {
  const parsed = spreadsheetMessageSchema.safeParse(message);

  if (!parsed.success) {
    logVerify('message.invalid', { message, error: parsed.error });
    return { status: 'unavailable' };
  }

  if (parsed.data.type === 'get-spreadsheet-settings') {
    return handlers.settings.load();
  }

  if (parsed.data.type === 'clear-spreadsheet-settings') {
    await handlers.settings.clear();
    return { status: 'cleared' };
  }

  if (parsed.data.type === 'find-existing-application') {
    return handlers.findExistingApplication.execute(parsed.data.url);
  }

  if (parsed.data.type === 'match-applications') {
    return handlers.findExistingApplication.executeMany(parsed.data.urls);
  }

  if (parsed.data.type === 'link-application') {
    return handlers.linkApplication.execute(parsed.data.application);
  }

  logVerify('message.in', message);

  const result = await handlers.validateSpreadsheetConfig.execute(
    parsed.data.url,
  );
  logVerify('message.out', result);

  return result;
}
