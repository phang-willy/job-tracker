import {
  canonicalLinkedInJobUrl,
  linkedinJobIdFromUrl,
} from '@/src/domain/job-offer/normalizers/linkedin-url';
import { collapseWhitespace, fold } from '@/src/domain/shared/text';

export type TrackerRow = {
  jobUrl: string;
  noteLink: HTMLElement;
};

export function queryDeep(root: ParentNode, selector: string): Element[] {
  const found: Element[] = [];
  const visit = (node: ParentNode) => {
    found.push(...node.querySelectorAll(selector));

    for (const element of node.querySelectorAll('*')) {
      if (element.shadowRoot !== null) {
        visit(element.shadowRoot);
      }
    }
  };

  visit(root);

  return found;
}

export function readTrackerRows(root: ParentNode): TrackerRow[] {
  const rows: TrackerRow[] = [];
  const seenNotes = new Set<HTMLElement>();
  const links = queryDeep(root, 'a[href*="/jobs/view/"]').filter(
    (link): link is HTMLAnchorElement => link instanceof HTMLAnchorElement,
  );

  for (const link of links) {
    const row = rowElement(link);

    if (row === null) {
      continue;
    }

    const note = noteForLink(row, link);
    const jobUrl = canonicalLinkedInJobUrl(
      link.getAttribute('href') ?? '',
      null,
    );
    const jobId = linkedinJobIdFromUrl(jobUrl);

    if (note === null || jobId === null || seenNotes.has(note)) {
      continue;
    }

    seenNotes.add(note);
    rows.push({ jobUrl, noteLink: note });
  }

  return rows;
}

function rowElement(link: HTMLAnchorElement): Element | null {
  let current: Element | null = link;

  for (let depth = 0; current !== null && depth < 30; depth += 1) {
    if (notesIn(current).length > 0 && viewLinks(current).includes(link)) {
      return current;
    }

    current = parentAcross(current);
  }

  return null;
}

function parentAcross(element: Element): Element | null {
  if (element.parentElement !== null) {
    return element.parentElement;
  }

  const root = element.getRootNode();

  return root instanceof ShadowRoot ? root.host : null;
}

function noteForLink(
  row: Element,
  link: HTMLAnchorElement,
): HTMLElement | null {
  const notes = notesIn(row);
  const views = viewLinks(row).filter((view) => jobIdOf(view) !== null);
  const index = views.indexOf(link);

  if (notes.length === 1) {
    return notes[0] ?? null;
  }

  return index === -1 ? null : (notes[index] ?? null);
}

function viewLinks(element: Element): HTMLAnchorElement[] {
  return queryDeep(element, 'a[href*="/jobs/view/"]').filter(
    (link): link is HTMLAnchorElement => link instanceof HTMLAnchorElement,
  );
}

function notesIn(element: Element): HTMLElement[] {
  const notes = queryDeep(element, 'a, button, [role="button"]').filter(
    (node): node is HTMLElement =>
      node instanceof HTMLElement && isNoteLink(node),
  );

  return notes.filter(
    (note) => !notes.some((other) => other !== note && other.contains(note)),
  );
}

function isNoteLink(element: Element): boolean {
  const text = fold(
    `${collapseWhitespace(element.textContent ?? '')} ${element.getAttribute('aria-label') ?? ''}`,
  );

  return (
    text.includes('ajouter une note') ||
    (element.querySelector('svg#add-small') !== null && text.includes('note'))
  );
}

function jobIdOf(link: HTMLAnchorElement): string | null {
  return linkedinJobIdFromUrl(
    canonicalLinkedInJobUrl(link.getAttribute('href') ?? '', null),
  );
}
