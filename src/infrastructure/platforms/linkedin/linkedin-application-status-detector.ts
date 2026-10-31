import {
  interpretApplicationSignals,
  isStatusDemandHeading,
} from '@/src/domain/job-offer/application-status';
import type { SiteApplicationStatus } from '@/src/domain/job-offer/application-status';
import { collapseWhitespace } from '@/src/domain/shared/text';
import {
  LINKEDIN_BANNER_ID,
  LINKEDIN_DETAIL_SELECTORS,
  LINKEDIN_SDUI_JOB_DETAILS,
} from '@/src/infrastructure/platforms/linkedin/selectors';

export class LinkedInApplicationStatusDetector {
  detect(root: ParentNode): SiteApplicationStatus {
    const roots = offerRoots(root);
    const heading = statusHeading(root);
    const buttons = roots.flatMap((scope) => applyLabels(scope));

    return interpretApplicationSignals({
      statusHeading: collapseWhitespace(heading?.textContent ?? ''),
      statusText: heading === null ? '' : blockText(heading),
      buttonLabels: buttons,
    });
  }
}

function offerRoots(root: ParentNode): Element[] {
  const roots: Element[] = [];
  const banner = root.querySelector(`[id^="${'JobDetails_ManageJobBanner_'}"]`);

  if (banner instanceof Element && LINKEDIN_BANNER_ID.test(banner.id)) {
    roots.push(...(hasSignals(banner) ? [banner] : offerScope(banner)));
  }

  const screen = root.querySelector(LINKEDIN_SDUI_JOB_DETAILS);

  if (screen instanceof Element) {
    roots.push(screen);
  }

  if (roots.length > 0) {
    return roots;
  }

  for (const selector of LINKEDIN_DETAIL_SELECTORS) {
    const found = root.querySelector(selector);

    if (found instanceof Element) {
      return [found];
    }
  }

  return [];
}

function applyLabels(scope: Element): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  const push = (label: string) => {
    if (label === '' || label.length > 80 || seen.has(label)) {
      return;
    }

    seen.add(label);
    labels.push(label);
  };

  for (const element of scope.querySelectorAll(
    'button, a, [role="button"], span',
  )) {
    if (element.closest('article, .jobs-description__content') !== null) {
      continue;
    }

    push(collapseWhitespace(element.getAttribute('aria-label') ?? ''));
    push(ownText(element));
    push(collapseWhitespace(element.textContent ?? ''));
  }

  return labels;
}

function offerScope(banner: Element): Element[] {
  let current: Element = banner;

  for (let depth = 0; depth < 6; depth += 1) {
    const parent: HTMLElement | null = current.parentElement;

    if (parent === null || parent === current.ownerDocument.body) {
      break;
    }

    if ([...parent.children].some((child) => hasSignals(child))) {
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

    if (siblings.some((sibling) => hasSignals(sibling))) {
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

function hasSignals(element: Element): boolean {
  return (
    element.matches('button, a, [role="button"]') ||
    element.querySelector('h1, h2, button, a, [role="button"]') !== null
  );
}

export function findStatusDemandHeading(root: ParentNode): HTMLElement | null {
  const heading = statusHeading(root);

  return heading instanceof HTMLElement ? heading : null;
}

function statusHeading(root: ParentNode): Element | null {
  for (const heading of root.querySelectorAll(
    'h1, h2, h3, h4, p, span, div, strong',
  )) {
    if (isStatusDemandHeading(ownText(heading))) {
      return heading;
    }
  }

  return null;
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

function blockText(heading: Element): string {
  const following = textAfter(heading);
  const parent = heading.parentElement;
  const aroundParent = parent === null ? '' : textAfter(parent);
  const combined = collapseWhitespace(
    `${following} ${aroundParent} ${parent?.textContent ?? ''}`,
  );

  if (combined.length > 0 && combined.length <= 400) {
    return combined;
  }

  return following;
}

function textAfter(heading: Element): string {
  const chunks = [heading.textContent ?? ''];
  let sibling = heading.nextElementSibling;

  while (sibling !== null && !/^H[1-3]$/.test(sibling.tagName)) {
    chunks.push(sibling.textContent ?? '');
    sibling = sibling.nextElementSibling;
  }

  return collapseWhitespace(chunks.join(' '));
}
