import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChromeGoogleAuth } from '@/src/infrastructure/google/chrome-google-auth';
import {
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_TOKEN_LIFETIME_MS,
} from '@/src/infrastructure/google/google-oauth-redirect';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ChromeGoogleAuth', () => {
  it('renews a missing session token without opening the consent window', async () => {
    const storage = new Map<string, unknown>();
    const launch = vi.fn((details: { interactive: boolean }) => {
      expect(details.interactive).toBe(false);

      return Promise.resolve(
        'https://extension.example/#access_token=fresh&expires_in=3600',
      );
    });

    stubBrowser(storage, launch);

    await expect(new ChromeGoogleAuth().getAccessToken()).resolves.toBe(
      'fresh',
    );
    expect(launch).toHaveBeenCalledOnce();
    expect(storage.get('googleAccessToken')).toMatchObject({
      accessToken: 'fresh',
      expiresAt: expect.any(Number),
    });

    const stored = storage.get('googleAccessToken') as { expiresAt: number };

    expect(stored.expiresAt).toBeGreaterThan(
      Date.now() + GOOGLE_TOKEN_LIFETIME_MS - 5_000,
    );
  });

  it('reuses a session token that is still valid', async () => {
    const storage = new Map<string, unknown>([
      [
        'googleAccessToken',
        { accessToken: 'cached', expiresAt: Date.now() + 60 * 60 * 1000 },
      ],
    ]);
    const launch = vi.fn(() => Promise.resolve('unused'));

    stubBrowser(storage, launch);

    await expect(new ChromeGoogleAuth().getAccessToken()).resolves.toBe(
      'cached',
    );
    expect(launch).not.toHaveBeenCalled();
  });

  it('asks for consent again when the cached token lacks the Drive scope', async () => {
    const storage = new Map<string, unknown>([
      [
        'googleAccessToken',
        { accessToken: 'cached', expiresAt: Date.now() + 60 * 60 * 1000 },
      ],
    ]);
    const launch = vi.fn((details: { interactive: boolean; url: string }) => {
      expect(details.interactive).toBe(true);

      return Promise.resolve(
        'https://extension.example/#access_token=fresh&expires_in=3600',
      );
    });

    stubBrowser(storage, launch);

    await new ChromeGoogleAuth().connectInteractively();

    expect(launch).toHaveBeenCalledOnce();
    expect(launch.mock.calls[0]?.[0]).toMatchObject({ interactive: true });
    expect(storage.get('googleAccessToken')).toMatchObject({
      accessToken: 'fresh',
      scopeStamp: GOOGLE_OAUTH_SCOPES.join(' '),
    });
  });
});

function stubBrowser(
  storage: Map<string, unknown>,
  launch: (details: { interactive: boolean; url: string }) => Promise<string>,
): void {
  vi.stubGlobal('browser', {
    storage: {
      session: {
        get: (key: string) => Promise.resolve({ [key]: storage.get(key) }),
        set: (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) {
            storage.set(key, value);
          }

          return Promise.resolve();
        },
        remove: (key: string) => {
          storage.delete(key);

          return Promise.resolve();
        },
      },
    },
    identity: {
      getRedirectURL: () => 'https://extension.example/',
      launchWebAuthFlow: launch,
    },
    runtime: {
      getManifest: () => ({
        oauth2: { client_id: 'client.apps.googleusercontent.com' },
      }),
    },
  });
}
