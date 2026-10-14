import {
  buildGoogleAuthUrl,
  isTokenUsable,
  parseOAuthRedirect,
} from '@/src/infrastructure/google/google-oauth-redirect';

export interface GoogleAuthGateway {
  getAccessToken(): Promise<string>;
  invalidateAccessToken(token: string): Promise<void>;
}

const STORAGE_KEY = 'googleAccessToken';

type StoredToken = {
  accessToken: string;
  expiresAt: number;
};

export type GoogleAuthErrorCode =
  'missing_client' | 'redirect_mismatch' | 'denied' | 'missing_token';

export class GoogleAuthError extends Error {
  constructor(
    readonly code: GoogleAuthErrorCode,
    readonly redirectUri?: string,
  ) {
    super(code);
  }
}

export class ChromeGoogleAuth implements GoogleAuthGateway {
  async getAccessToken(): Promise<string> {
    const cached = await this.readCachedToken();

    if (cached == null) {
      throw new Error('Jeton Google absent.');
    }

    return cached;
  }

  async connectInteractively(): Promise<void> {
    const cached = await this.readCachedToken();

    if (cached != null) {
      return;
    }

    const clientId = readManifestClientId();
    const redirectUri = browser.identity.getRedirectURL();

    if (clientId == null) {
      throw new GoogleAuthError('missing_client', redirectUri);
    }

    let responseUrl: string | undefined;

    try {
      responseUrl = await browser.identity.launchWebAuthFlow({
        interactive: true,
        url: buildGoogleAuthUrl({ clientId, redirectUri }),
      });
    } catch (error) {
      throw mapLaunchError(error, redirectUri);
    }

    if (responseUrl == null) {
      throw new GoogleAuthError('missing_token', redirectUri);
    }

    const parsed = parseOAuthRedirect(responseUrl);

    if (!parsed.ok) {
      throw mapOAuthError(parsed.error, redirectUri);
    }

    const stored: StoredToken = {
      accessToken: parsed.accessToken,
      expiresAt: Date.now() + parsed.expiresInSeconds * 1000,
    };

    await browser.storage.session.set({ [STORAGE_KEY]: stored });
  }

  async invalidateAccessToken(token: string): Promise<void> {
    const stored = await browser.storage.session.get(STORAGE_KEY);
    const value: unknown = stored[STORAGE_KEY];

    if (!isStoredToken(value) || value.accessToken === token) {
      await browser.storage.session.remove(STORAGE_KEY);
    }
  }

  private async readCachedToken(): Promise<string | null> {
    const stored = await browser.storage.session.get(STORAGE_KEY);
    const value: unknown = stored[STORAGE_KEY];

    if (!isStoredToken(value) || !isTokenUsable(value.expiresAt, Date.now())) {
      return null;
    }

    return value.accessToken;
  }
}

export function isMissingOAuthClient(error: unknown): boolean {
  return error instanceof GoogleAuthError && error.code === 'missing_client';
}

function readManifestClientId(): string | undefined {
  const clientId = browser.runtime.getManifest().oauth2?.client_id.trim();

  return clientId == null || clientId.length === 0 ? undefined : clientId;
}

function isStoredToken(value: unknown): value is StoredToken {
  if (value == null || typeof value !== 'object') {
    return false;
  }

  const record = value as { accessToken?: unknown; expiresAt?: unknown };

  return (
    typeof record.accessToken === 'string' &&
    record.accessToken.length > 0 &&
    typeof record.expiresAt === 'number'
  );
}

function mapLaunchError(error: unknown, redirectUri: string): GoogleAuthError {
  const message = error instanceof Error ? error.message : String(error);

  if (/redirect_uri/i.test(message)) {
    return new GoogleAuthError('redirect_mismatch', redirectUri);
  }

  if (/did not approve|not granted|access_denied|revoked/i.test(message)) {
    return new GoogleAuthError('denied', redirectUri);
  }

  return new GoogleAuthError('missing_token', redirectUri);
}

function mapOAuthError(error: string, redirectUri: string): GoogleAuthError {
  if (/redirect_uri/i.test(error)) {
    return new GoogleAuthError('redirect_mismatch', redirectUri);
  }

  if (/access_denied|consent_required/i.test(error)) {
    return new GoogleAuthError('denied', redirectUri);
  }

  return new GoogleAuthError('missing_token', redirectUri);
}
