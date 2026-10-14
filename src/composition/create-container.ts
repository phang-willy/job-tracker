import { ChromeSpreadsheetSettingsStore } from '@/src/infrastructure/chrome/chrome-spreadsheet-settings-store';
import { ChromeGoogleAuth } from '@/src/infrastructure/google/chrome-google-auth';
import { GoogleSheetsGateway } from '@/src/infrastructure/google/google-sheets-gateway';
import { ValidateSpreadsheetConfig } from '@/src/application/use-cases/validate-spreadsheet-config';

export function createContainer() {
  const settings = new ChromeSpreadsheetSettingsStore();

  return {
    settings,
    validateSpreadsheetConfig: new ValidateSpreadsheetConfig(
      new GoogleSheetsGateway(new ChromeGoogleAuth()),
      settings,
    ),
  };
}
