import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';
import { extensionHostPermissions } from './src/infrastructure/platforms/supported-hosts';

const googleClientId = readGoogleClientId();

function readGoogleClientId(): string | undefined {
  const fromProcess = process.env.WXT_GOOGLE_CLIENT_ID?.trim();

  if (fromProcess) {
    return fromProcess;
  }

  try {
    const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '.env');
    const value = parseEnv(
      readFileSync(envPath, 'utf8'),
    ).WXT_GOOGLE_CLIENT_ID?.trim();

    return value ? value : undefined;
  } catch {
    return undefined;
  }
}

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Job Tracker',
    description:
      'Suivi des candidatures LinkedIn, Indeed, HelloWork et Welcome to the Jungle.',
    permissions: ['storage', 'identity', 'alarms', 'activeTab', 'windows'],
    host_permissions: [...extensionHostPermissions],
    ...(googleClientId
      ? {
          oauth2: {
            client_id: googleClientId,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          },
        }
      : {}),
    icons: {
      16: '/images/icon-16.png',
      32: '/images/icon-32.png',
      48: '/images/icon-48.png',
      128: '/images/icon-128.png',
    },
    action: {
      default_icon: {
        16: '/images/icon-16.png',
        32: '/images/icon-32.png',
        48: '/images/icon-48.png',
        128: '/images/icon-128.png',
      },
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
