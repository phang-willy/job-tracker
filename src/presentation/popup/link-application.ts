import {
  linkApplicationResultSchema,
  type LinkApplicationResult,
} from '@/src/application/dto/spreadsheet-messages';
import type { ApplicationDraft } from '@/src/domain/spreadsheet/application-draft';

export async function linkApplication(
  draft: ApplicationDraft,
): Promise<LinkApplicationResult> {
  const response: unknown = await browser.runtime.sendMessage({
    type: 'link-application',
    application: draft,
  });
  const parsed = linkApplicationResultSchema.safeParse(response);

  if (!parsed.success) {
    return {
      status: 'unavailable',
      detail: 'Réponse du tableur illisible.',
    };
  }

  return parsed.data;
}

export function linkFailureMessage(
  result: Exclude<LinkApplicationResult, { status: 'found' }>,
): string {
  switch (result.status) {
    case 'invalid':
      return invalidFieldMessage(result.field);
    case 'missing_sheet':
      return `L'onglet ${result.year} n'existe pas. Aucune ligne n'a été ajoutée.`;
    case 'unsorted':
      return "La colonne Postulé le n'est pas dans l'ordre, ou une date n'est pas lisible. Aucune ligne n'a été ajoutée.";
    case 'unconfirmed':
      return "La ligne n'a pas été retrouvée dans le tableur après l'envoi.";
    case 'not_configured':
      return "Tableur non connecté. Aucune ligne n'a été ajoutée.";
    case 'unauthenticated':
      return 'Connexion Google expirée. Ouvre Paramètres et vérifie le classeur, puis réessaie.';
    case 'oauth_not_configured':
      return "La connexion Google n'est pas configurée.";
    case 'access_denied':
      return result.cause === 'sheets_api_disabled'
        ? "L'API Google Sheets n'est pas activée."
        : "Accès refusé sur ce classeur. Aucune ligne n'a été ajoutée.";
    case 'denied':
      return "Accès en écriture refusé sur ce classeur. Aucune ligne n'a été ajoutée.";
    case 'unavailable':
      return result.detail == null || result.detail.trim() === ''
        ? "Impossible d'écrire dans le tableur."
        : `Impossible d'écrire dans le tableur : ${result.detail}`;
  }
}

function invalidFieldMessage(
  field: 'company' | 'title' | 'url' | 'date',
): string {
  switch (field) {
    case 'company':
      return 'Indique la société avant de lier au tableur.';
    case 'title':
      return 'Indique le poste avant de lier au tableur.';
    case 'url':
      return "Le lien de l'offre est vide.";
    case 'date':
      return 'La date de candidature est invalide.';
  }
}
