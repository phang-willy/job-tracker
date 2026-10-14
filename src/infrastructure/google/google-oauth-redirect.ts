export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const EXPIRY_MARGIN_MS = 60_000;

export function buildGoogleAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  scope?: string;
}): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', input.scope ?? SHEETS_SCOPE);
  url.searchParams.set('include_granted_scopes', 'true');

  return url.href;
}

export type ParsedOAuthRedirect =
  | { ok: true; accessToken: string; expiresInSeconds: number }
  | { ok: false; error: string };

export function parseOAuthRedirect(redirectUrl: string): ParsedOAuthRedirect {
  const url = new URL(redirectUrl);
  const hash = new URLSearchParams(
    url.hash.startsWith('#') ? url.hash.slice(1) : url.hash,
  );
  const error = hash.get('error') ?? url.searchParams.get('error');

  if (error != null && error.length > 0) {
    return { ok: false, error };
  }

  const accessToken =
    hash.get('access_token') ?? url.searchParams.get('access_token');

  if (accessToken == null || accessToken.length === 0) {
    return { ok: false, error: 'missing_token' };
  }

  const expiresRaw = Number(
    hash.get('expires_in') ?? url.searchParams.get('expires_in'),
  );

  return {
    ok: true,
    accessToken,
    expiresInSeconds:
      Number.isFinite(expiresRaw) && expiresRaw > 0 ? expiresRaw : 3600,
  };
}

export function isTokenUsable(expiresAt: number, now: number): boolean {
  return expiresAt - EXPIRY_MARGIN_MS > now;
}
