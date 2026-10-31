import { SettingsPanel } from '@/src/presentation/options/SettingsPanel';
import { useSpreadsheetSettings } from '@/src/presentation/options/use-spreadsheet-settings';

export function OptionsApp() {
  const settings = useSpreadsheetSettings();

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-white p-6 text-sm text-neutral-900">
      <SettingsPanel
        saved={settings.saved}
        onVerify={settings.verify}
        onReverify={settings.reverify}
        onDesync={settings.desync}
      />
    </main>
  );
}
