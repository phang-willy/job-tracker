export type ActiveTabSummary = {
  title: string;
  location: string;
};

export function describeActiveTab(
  tab: { title?: string; url?: string } | undefined,
): ActiveTabSummary {
  if (tab === undefined) {
    return { title: 'Aucun onglet actif', location: '' };
  }

  const title = tab.title?.trim() || 'Sans titre';

  return { title, location: formatLocation(tab.url) };
}

function formatLocation(url: string | undefined): string {
  if (url === undefined || url.trim() === '') {
    return '';
  }

  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
