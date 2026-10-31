import type {
  ExtractedJobDraft,
  JobOfferExtractor,
} from '@/src/application/ports/job-offer-extractor';
import { linkedinJobIdFromUrl } from '@/src/domain/job-offer/normalizers/linkedin-url';
import { parseLinkedInPageTitle } from '@/src/domain/job-offer/page-title';
import { collapseWhitespace, fold } from '@/src/domain/shared/text';
import {
  LINKEDIN_BANNER_ID,
  LINKEDIN_CHECK_ICON_ID,
  LINKEDIN_DETAIL_SELECTORS,
  LINKEDIN_SDUI_JOB_DETAILS,
} from '@/src/infrastructure/platforms/linkedin/selectors';

const CHECK_ICON = `svg[id="${LINKEDIN_CHECK_ICON_ID}"]`;

export class LinkedInJobExtractor implements JobOfferExtractor {
  extract(root: ParentNode): ExtractedJobDraft | null {
    const located = locate(root);

    if (located === null) {
      return null;
    }

    const heading = parseLinkedInPageTitle(documentTitle(root));
    const company = readCompany(located.roots) || heading.company;

    return {
      company,
      title: readTitle(located.roots, company, heading.title),
      locationCandidates: [
        ...(heading.location === '' ? [] : [heading.location]),
        ...readLocationCandidates(located.roots),
      ],
      contractLabels: readContractLabels(located.roots),
      salaryTexts: readSalaryTexts(located.roots),
      jobId: located.jobId,
    };
  }
}

function locate(
  root: ParentNode,
): { roots: Element[]; jobId: string | null } | null {
  const banner = findBanner(root);

  if (banner !== null) {
    return { roots: offerScope(banner.element), jobId: banner.jobId };
  }

  const screen = root.querySelector(LINKEDIN_SDUI_JOB_DETAILS);

  if (screen instanceof Element) {
    return { roots: [screen], jobId: jobIdWithin(screen) };
  }

  const fallback = findFallback(root);

  if (fallback === null) {
    return null;
  }

  return { roots: [fallback], jobId: jobIdWithin(fallback) };
}

function findBanner(
  root: ParentNode,
): { element: Element; jobId: string } | null {
  const element = root.querySelector(
    `[id^="${'JobDetails_ManageJobBanner_'}"]`,
  );

  if (!(element instanceof Element)) {
    return null;
  }

  const jobId = LINKEDIN_BANNER_ID.exec(element.id)?.[1];

  if (jobId === undefined) {
    return null;
  }

  return { element, jobId };
}

function findFallback(root: ParentNode): Element | null {
  for (const selector of LINKEDIN_DETAIL_SELECTORS) {
    const found = root.querySelector(selector);

    if (found instanceof Element) {
      return found;
    }
  }

  return null;
}

function offerScope(banner: Element): Element[] {
  let current: Element = banner;

  for (let depth = 0; depth < 6; depth += 1) {
    const parent: HTMLElement | null = current.parentElement;

    if (parent === null || parent === current.ownerDocument.body) {
      break;
    }

    if ([...parent.children].some((child) => hasJobSignals(child))) {
      return [...parent.children];
    }

    current = parent;
  }

  return scopeRoots(banner);
}

function scopeRoots(banner: Element): Element[] {
  let current: Element | null = banner;

  for (let depth = 0; current !== null && depth < 6; depth += 1) {
    const siblings = followingSiblings(current);

    if (siblings.some((sibling) => hasJobSignals(sibling))) {
      return siblings;
    }

    const parent: HTMLElement | null = current.parentElement;

    if (parent === null || parent === current.ownerDocument.body) {
      break;
    }

    current = parent;
  }

  return [];
}

function followingSiblings(element: Element): Element[] {
  const siblings: Element[] = [];
  let sibling = element.nextElementSibling;

  while (sibling !== null) {
    siblings.push(sibling);
    sibling = sibling.nextElementSibling;
  }

  return siblings;
}

function hasJobSignals(element: Element): boolean {
  return (
    element.matches('h1, h2, a[href*="/company/"], a[href*="/jobs/view/"]') ||
    element.querySelector(
      'h1, h2, a[href*="/company/"], a[href*="/jobs/view/"]',
    ) !== null
  );
}

function readCompany(roots: readonly Element[]): string {
  for (const link of elementsIn(roots, 'a[href*="/company/"]')) {
    if (!(link instanceof HTMLAnchorElement) || isDescription(link)) {
      continue;
    }

    const label = linkLabel(link);

    if (label !== '') {
      return label;
    }
  }

  return '';
}

function readTitle(
  roots: readonly Element[],
  company: string,
  pageTitle: string,
): string {
  if (isUsableTitle(pageTitle, company)) {
    return pageTitle;
  }

  for (const heading of elementsIn(roots, 'h1, h2, h3')) {
    if (isDescription(heading)) {
      continue;
    }

    const text = collapseWhitespace(heading.textContent ?? '');

    if (isUsableTitle(text, company)) {
      return text;
    }
  }

  for (const link of elementsIn(roots, 'a[href*="/jobs/view/"]')) {
    if (
      !(link instanceof HTMLAnchorElement) ||
      isDescription(link) ||
      isContractOrSalaryPill(link)
    ) {
      continue;
    }

    const text = collapseWhitespace(link.textContent ?? '');

    if (isUsableTitle(text, company)) {
      return text;
    }
  }

  return '';
}

function readLocationCandidates(roots: readonly Element[]): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const push = (text: string) => {
    if (
      text.length < 2 ||
      text.length > 120 ||
      text.includes('€') ||
      isJobChrome(text) ||
      seen.has(text)
    ) {
      return;
    }

    seen.add(text);
    candidates.push(text);
  };

  for (const span of elementsIn(roots, 'p > span')) {
    if (isDescription(span) || isContractOrSalaryPill(span)) {
      continue;
    }

    push(collapseWhitespace(span.textContent ?? ''));
  }

  for (const element of elementsIn(
    roots,
    'span, p, li, div, time, h1, h2, h3, a',
  )) {
    if (
      isDescription(element) ||
      element.closest('button') !== null ||
      isContractOrSalaryPill(element)
    ) {
      continue;
    }

    const text = ownText(element);

    if (element instanceof HTMLAnchorElement && !text.includes(',')) {
      continue;
    }

    push(text);
  }

  return candidates;
}

function readContractLabels(roots: readonly Element[]): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  const push = (text: string) => {
    if (text.length < 2 || text.length > 40 || seen.has(text)) {
      return;
    }

    seen.add(text);
    labels.push(text);
  };

  for (const icon of elementsIn(roots, CHECK_ICON)) {
    if (icon.closest('a') === null || isDescription(icon)) {
      continue;
    }

    const label = icon.nextElementSibling;

    if (label === null || label.tagName !== 'SPAN') {
      continue;
    }

    push(collapseWhitespace(label.textContent ?? ''));
  }

  for (const element of elementsIn(roots, 'button, li')) {
    if (
      isDescription(element) ||
      element.closest('a')?.querySelector(CHECK_ICON) != null
    ) {
      continue;
    }

    if (
      element.tagName === 'LI' &&
      element.querySelector(`button, ${CHECK_ICON}`) !== null
    ) {
      continue;
    }

    push(collapseWhitespace(element.textContent ?? ''));
  }

  return labels;
}

function readSalaryTexts(roots: readonly Element[]): string[] {
  const texts: string[] = [];
  const seen = new Set<string>();

  for (const anchor of elementsIn(roots, 'a[href*="/jobs/view/"]')) {
    if (!(anchor instanceof HTMLAnchorElement) || isDescription(anchor)) {
      continue;
    }

    for (const span of anchor.querySelectorAll(':scope > span > span')) {
      const text = collapseWhitespace(span.textContent ?? '');

      if (!text.includes('€') || seen.has(text)) {
        continue;
      }

      seen.add(text);
      texts.push(text);
    }
  }

  return texts;
}

function linkLabel(link: HTMLAnchorElement): string {
  const text = collapseWhitespace(link.textContent ?? '');

  if (text !== '') {
    return text;
  }

  const labelled = link.getAttribute('aria-label');

  if (labelled !== null && collapseWhitespace(labelled) !== '') {
    return collapseWhitespace(labelled);
  }

  return collapseWhitespace(
    link.querySelector('img[alt]')?.getAttribute('alt') ?? '',
  );
}

function isUsableTitle(text: string, company: string): boolean {
  if (
    text === '' ||
    text === company ||
    text.length > 160 ||
    isJobChrome(text)
  ) {
    return false;
  }

  const value = fold(text);

  return !value.startsWith('a propos') && !value.startsWith('about the job');
}

function isJobChrome(text: string): boolean {
  const value = fold(text);

  return (
    value.includes('votre profil') ||
    value.includes('your profile') ||
    value.includes("utilisez l'ia") ||
    value.includes('use ai to')
  );
}

function isContractOrSalaryPill(element: Element): boolean {
  const anchor = element.closest('a');

  if (anchor === null) {
    return false;
  }

  return (
    anchor.querySelector(CHECK_ICON) !== null ||
    collapseWhitespace(anchor.textContent ?? '').includes('€')
  );
}

function isDescription(element: Element): boolean {
  return element.closest('article, .jobs-description__content') !== null;
}

function documentTitle(root: ParentNode): string {
  const owner = root instanceof Document ? root : root.ownerDocument;

  if (owner === null) {
    return '';
  }

  const fromHead = collapseWhitespace(
    owner.head?.querySelector('title')?.textContent ?? '',
  );

  if (fromHead !== '') {
    return fromHead;
  }

  return collapseWhitespace(owner.title);
}

function jobIdWithin(element: Element): string | null {
  for (const link of element.querySelectorAll('a[href*="/jobs/view/"]')) {
    const href = link.getAttribute('href');

    if (href === null) {
      continue;
    }

    const jobId = linkedinJobIdFromUrl(href);

    if (jobId !== null) {
      return jobId;
    }
  }

  return null;
}

function elementsIn(roots: readonly Element[], selector: string): Element[] {
  const found: Element[] = [];
  const seen = new Set<Element>();

  for (const root of roots) {
    const matched = root.matches(selector) ? [root] : [];

    for (const element of [...matched, ...root.querySelectorAll(selector)]) {
      if (seen.has(element)) {
        continue;
      }

      seen.add(element);
      found.push(element);
    }
  }

  return found;
}

function ownText(element: Element): string {
  let value = '';

  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      value += node.textContent ?? '';
    }
  }

  return collapseWhitespace(value);
}
