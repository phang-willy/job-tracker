import {
  savedSpreadsheetSettingsSchema,
  validateSpreadsheetResultSchema,
  type SavedSpreadsheetSettings,
  type ValidateSpreadsheetResult,
} from '@/src/application/dto/spreadsheet-messages';
import { parseSpreadsheetId } from '@/src/domain/spreadsheet/structure';
import {
  ChromeGoogleAuth,
  GoogleAuthError,
} from '@/src/infrastructure/google/chrome-google-auth';
import { logVerify } from '@/src/infrastructure/logging/verify-log';
import type { SettingsCheckResult } from '@/src/presentation/options/SettingsPanel';

export async function loadSpreadsheetSettings(): Promise<SavedSpreadsheetSettings | null> {
  const response: unknown = await browser.runtime.sendMessage({
    type: 'get-spreadsheet-settings',
  });
  const parsed = savedSpreadsheetSettingsSchema.nullable().safeParse(response);

  return parsed.success ? parsed.data : null;
}

export async function verifySpreadsheet(
  url: string,
): Promise<SettingsCheckResult> {
  const currentTab = await browser.tabs.getCurrent();

  if (currentTab == null) {
    await openSpreadsheetCheckWindow(url);

    return { status: 'consent_window' };
  }

  return runSpreadsheetCheck(url, true);
}

export async function reverifySpreadsheet(
  url: string,
): Promise<SettingsCheckResult> {
  const result = await runSpreadsheetCheck(url, false);

  if (result.status !== 'unauthenticated') {
    return result;
  }

  return verifySpreadsheet(url);
}

export async function runSpreadsheetCheck(
  url: string,
  interactive: boolean,
): Promise<
  ValidateSpreadsheetResult | { status: 'unauthenticated'; detail: string }
> {
  logVerify('check.start', { url });

  if (parseSpreadsheetId(url) === null) {
    const result = { status: 'invalid_url' } as const;
    logVerify('check.result', result);
    return result;
  }

  if (interactive) {
    try {
      await new ChromeGoogleAuth().connectInteractively();
      logVerify('check.auth', { status: 'ok' });
    } catch (error) {
      const result = googleAuthFailure(error);
      logVerify('check.auth', { error, result });
      return result;
    }
  }

  try {
    const response: unknown = await browser.runtime.sendMessage({
      type: 'validate-spreadsheet',
      url,
    });
    logVerify('check.response', response);
    const result = validateSpreadsheetResultSchema.parse(response);
    logVerify('check.result', result);

    return result;
  } catch (error) {
    logVerify('check.parse-error', error);
    return { status: 'unavailable' };
  }
}

async function openSpreadsheetCheckWindow(url: string): Promise<void> {
  await browser.windows.create({
    url: browser.runtime.getURL(
      `/sheet-check.html?url=${encodeURIComponent(url)}`,
    ),
    type: 'popup',
    width: 520,
    height: 680,
    focused: true,
  });
}

function googleAuthFailure(
  error: unknown,
): ValidateSpreadsheetResult | { status: 'unauthenticated'; detail: string } {
  if (!(error instanceof GoogleAuthError)) {
    return { status: 'unauthenticated' };
  }

  if (error.code === 'missing_client') {
    return { status: 'oauth_not_configured' };
  }

  if (error.code === 'redirect_mismatch' && error.redirectUri != null) {
    return {
      status: 'unauthenticated',
      detail: `Crée un client OAuth de type Application Web et ajoute cette URI de redirection : ${error.redirectUri}`,
    };
  }

  if (error.code === 'denied') {
    return {
      status: 'unauthenticated',
      detail:
        'Connexion Google refusée. Ajoute ce compte comme utilisateur test dans Google Cloud, puis réessaie.',
    };
  }

  return { status: 'unauthenticated' };
}
