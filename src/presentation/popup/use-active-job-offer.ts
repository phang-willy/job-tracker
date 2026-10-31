import { useEffect, useState } from 'react';
import { activeJobMessageSchema } from '@/src/application/dto/job-offer-messages';
import { isLinkedInUrl } from '@/src/domain/job-offer/platform';
import {
  applicationView,
  loadingApplicationView,
  type ApplicationView,
} from '@/src/presentation/popup/application-view';

export function useActiveJobOffer(): ApplicationView {
  const [view, setView] = useState<ApplicationView>(loadingApplicationView());

  useEffect(() => {
    let cancelled = false;

    void loadActiveJobOffer()
      .then((next) => {
        if (!cancelled) {
          setView(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setView(
            applicationView({ page: 'linkedin', extraction: 'unreachable' }),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return view;
}

export async function loadActiveJobOffer(): Promise<ApplicationView> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (tab === undefined) {
    return {
      status: 'unsupported',
      offer: null,
      application: null,
      notice: 'Aucun onglet actif.',
    };
  }

  if (!isLinkedInUrl(tab.url ?? '')) {
    return applicationView({ page: 'other' });
  }

  if (tab.id === undefined) {
    return applicationView({ page: 'linkedin', extraction: 'unreachable' });
  }

  try {
    const response: unknown = await browser.tabs.sendMessage(tab.id, {
      type: 'extract-active-job',
    });
    const parsed = activeJobMessageSchema.safeParse(response);

    if (!parsed.success) {
      return applicationView({ page: 'linkedin', extraction: 'unreachable' });
    }

    return applicationView({ page: 'linkedin', extraction: parsed.data });
  } catch {
    return applicationView({ page: 'linkedin', extraction: 'unreachable' });
  }
}
