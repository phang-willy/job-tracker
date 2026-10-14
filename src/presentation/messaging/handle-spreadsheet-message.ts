import type { ValidateSpreadsheetConfig } from '@/src/application/use-cases/validate-spreadsheet-config';
import type { SpreadsheetSettingsRepository } from '@/src/application/ports/spreadsheet';
import { spreadsheetMessageSchema } from '@/src/application/dto/spreadsheet-messages';
import { logVerify } from '@/src/infrastructure/logging/verify-log';

type SpreadsheetHandlers = {
  validateSpreadsheetConfig: ValidateSpreadsheetConfig;
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

  logVerify('message.in', message);

  const result = await handlers.validateSpreadsheetConfig.execute(
    parsed.data.url,
  );
  logVerify('message.out', result);

  return result;
}
