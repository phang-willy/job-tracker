import { describe, expect, it } from 'vitest';
import {
  buildGoogleAuthUrl,
  isTokenUsable,
  parseOAuthRedirect,
} from '@/src/infrastructure/google/google-oauth-redirect';

describe('Google OAuth redirect', () => {
  it('builds an implicit flow url for the sheets scope', () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: 'client.apps.googleusercontent.com',
        redirectUri: 'https://abc.chromiumapp.org/',
      }),
    );

    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(url.searchParams.get('response_type')).toBe('token');
    expect(url.searchParams.get('client_id')).toBe(
      'client.apps.googleusercontent.com',
    );
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://abc.chromiumapp.org/',
    );
    expect(url.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.metadata.readonly',
    );
  });

  it('reads the access token from the redirect hash', () => {
    expect(
      parseOAuthRedirect(
        'https://abc.chromiumapp.org/#access_token=ya29.token&expires_in=120&token_type=Bearer',
      ),
    ).toEqual({
      ok: true,
      accessToken: 'ya29.token',
      expiresInSeconds: 120,
    });
  });

  it('reports a refused consent', () => {
    expect(
      parseOAuthRedirect(
        'https://abc.chromiumapp.org/#error=access_denied&state=',
      ),
    ).toEqual({ ok: false, error: 'access_denied' });
  });

  it('treats a token as expired one minute before its deadline', () => {
    expect(isTokenUsable(1_000_000, 939_999)).toBe(true);
    expect(isTokenUsable(1_000_000, 940_000)).toBe(false);
  });
});
