import { FindExistingApplication } from '@/src/application/use-cases/find-existing-application';
import { LinkApplication } from '@/src/application/use-cases/link-application';
import { ValidateSpreadsheetConfig } from '@/src/application/use-cases/validate-spreadsheet-config';
import { ChromeSpreadsheetSettingsStore } from '@/src/infrastructure/chrome/chrome-spreadsheet-settings-store';
import { ChromeGoogleAuth } from '@/src/infrastructure/google/chrome-google-auth';
import { GoogleSheetsGateway } from '@/src/infrastructure/google/google-sheets-gateway';

export function createContainer() {
  const settings = new ChromeSpreadsheetSettingsStore();
  const sheets = new GoogleSheetsGateway(new ChromeGoogleAuth());

  return {
    settings,
    validateSpreadsheetConfig: new ValidateSpreadsheetConfig(sheets, settings),
    findExistingApplication: new FindExistingApplication(sheets, settings),
    linkApplication: new LinkApplication(sheets, sheets, settings),
  };
}
