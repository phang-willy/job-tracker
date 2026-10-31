import {
  existingApplicationResultSchema,
  trackedApplicationsResultSchema,
} from '@/src/application/dto/spreadsheet-messages';
import {
  offerPageBadge,
  trackerPageBadge,
  type JobBoardBadgeNotice,
} from '@/src/domain/job-offer/job-board-badge';
import {
  isAppliedJobsTrackerPage,
  isLinkedInJobViewPage,
} from '@/src/domain/job-offer/platform';
import { canonicalLinkedInJobUrl } from '@/src/domain/job-offer/normalizers/linkedin-url';
import { sheetPositionLabel } from '@/src/domain/spreadsheet/applications';
import { findStatusDemandHeading } from '@/src/infrastructure/platforms/linkedin/linkedin-application-status-detector';
import {
  queryDeep,
  readTrackerRows,
  type TrackerRow,
} from '@/src/domain/job-offer/tracker-rows';

export const SYNC_MARKER_ATTRIBUTE = 'data-job-tracker-sync';
export const OFFER_SYNC_ATTRIBUTE = 'data-job-offer-sync';

const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>`;

const CROSS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>`;

const INFO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`;

const MARKER_CSS = `
:host {
  position: relative;
  display: inline-flex;
  margin-left: 8px;
  vertical-align: middle;
}
button {
  display: inline-flex;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--jt-color);
  cursor: help;
}
svg {
  width: 16px;
  height: 16px;
}
.tip {
  position: absolute;
  z-index: 10000;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  border-radius: 6px;
  background: #171717;
  color: #fff;
  font: 12px/1.4 Arial, sans-serif;
  white-space: nowrap;
  padding: 6px 10px;
  opacity: 0;
  pointer-events: none;
}
.tip.wrap {
  white-space: normal;
  width: max-content;
  max-width: 240px;
}
:host(:hover) .tip,
:host(:focus-within) .tip {
  opacity: 1;
}
`;

type MarkerVisual = {
  icon: 'check' | 'cross' | 'info';
  tooltip: string;
};

export function sheetProblemMessage(result: {
  status: string;
  detail?: string;
}): string {
  const detail = result.detail?.trim() ?? '';

  switch (result.status) {
    case 'not_configured':
      return 'Tableur non connecté.';
    case 'unauthenticated':
      return 'Connexion Google requise.';
    case 'oauth_not_configured':
      return "La connexion Google n'est pas configurée.";
    case 'access_denied':
      return 'Accès refusé ou classeur introuvable.';
    default: {
      const base = 'Impossible de lire le tableur.';

      return detail === '' ? base : `${base} ${detail}`;
    }
  }
}

type TrackedMatch = {
  url: string;
  status: 'missing' | 'found';
  application?: { sheet: string; row: number; lastRow: number };
};

export function syncTooltip(match: TrackedMatch): string {
  if (match.status === 'missing' || match.application === undefined) {
    return 'Pas encore enregistrée dans le tableur.';
  }

  return sheetPositionLabel(
    match.application.sheet,
    match.application.row,
    match.application.lastRow,
  );
}

export function paintTrackerSync(
  rows: readonly TrackerRow[],
  matches: readonly TrackedMatch[],
): void {
  const byUrl = new Map(matches.map((match) => [match.url, match]));
  const parents = new Set<HTMLElement>();

  for (const row of rows) {
    const parent = markerParent(row.noteLink);
    const match = byUrl.get(row.jobUrl);

    if (parent === null || match === undefined) {
      continue;
    }

    parents.add(parent);
    const host = markerHost(parent);
    renderSyncMarker(host, visualForMatch(match));
  }

  const doc = rows[0]?.noteLink.ownerDocument;

  if (doc === null || doc === undefined) {
    return;
  }

  for (const marker of queryDeep(doc, `[${SYNC_MARKER_ATTRIBUTE}]`)) {
    if (!parents.has(marker.parentElement as HTMLElement)) {
      marker.remove();
    }
  }
}

export function clearTrackerMarkers(root: ParentNode): void {
  for (const marker of queryDeep(root, `[${SYNC_MARKER_ATTRIBUTE}]`)) {
    marker.remove();
  }
}

export async function lookupTrackedApplications(
  send: (message: unknown) => Promise<unknown>,
  urls: readonly string[],
): Promise<unknown> {
  const batch: unknown = await send({ type: 'match-applications', urls });
  const parsed = trackedApplicationsResultSchema.safeParse(batch);

  if (
    parsed.success &&
    (parsed.data.status === 'ok' || parsed.data.status === 'not_configured')
  ) {
    return parsed.data;
  }

  const matches: Array<
    | { url: string; status: 'missing' }
    | {
        url: string;
        status: 'found';
        application: {
          sheet: string;
          row: number;
          lastRow: number;
          url: string;
          status: string;
          appliedOn: string;
        };
      }
  > = [];

  for (const url of urls) {
    const one: unknown = await send({
      type: 'find-existing-application',
      url,
    });
    const result = existingApplicationResultSchema.safeParse(one);

    if (!result.success) {
      return { status: 'unavailable' };
    }

    if (result.data.status === 'found') {
      matches.push({
        url,
        status: 'found',
        application: result.data.application,
      });
      continue;
    }

    if (result.data.status === 'missing') {
      matches.push({ url, status: 'missing' });
      continue;
    }

    return result.data;
  }

  return { status: 'ok', matches };
}

export async function syncTrackerPage(
  doc: Document,
  pageUrl: string,
  ask: (urls: readonly string[]) => Promise<unknown>,
  isCurrent: () => boolean = () => true,
  onBadge?: (notice: JobBoardBadgeNotice) => void,
): Promise<boolean> {
  const report = (text: string) => {
    if (isCurrent()) {
      onBadge?.({ scope: 'tracker', text });
    }
  };

  if (!isAppliedJobsTrackerPage(pageUrl)) {
    clearTrackerMarkers(doc);
    report('');
    return false;
  }

  const rows = readTrackerRows(doc);

  if (!isCurrent()) {
    return false;
  }

  if (rows.length === 0) {
    clearTrackerMarkers(doc);
    report('');
    return false;
  }

  const jobs = uniqueRows(rows);
  let response: unknown;

  try {
    response = await ask(jobs.map((row) => row.jobUrl));
  } catch {
    if (isCurrent()) {
      paintTrackerProblem(rows, sheetProblemMessage({ status: 'error' }));
      report('!');
    }

    return false;
  }

  if (!isCurrent()) {
    return false;
  }

  const parsed = trackedApplicationsResultSchema.safeParse(response);

  if (!parsed.success || parsed.data.status !== 'ok') {
    paintTrackerProblem(
      rows,
      sheetProblemMessage(parsed.success ? parsed.data : { status: 'unread' }),
    );
    report('!');
    return false;
  }

  paintTrackerSync(rows, parsed.data.matches);
  report(
    trackerPageBadge({
      sheet: 'ok',
      jobUrls: jobs.map((row) => row.jobUrl),
      savedUrls: parsed.data.matches
        .filter((match) => match.status === 'found')
        .map((match) => match.url),
    }),
  );
  return true;
}

export async function syncOfferStatusPage(
  doc: Document,
  pageUrl: string,
  ask: (urls: readonly string[]) => Promise<unknown>,
  isCurrent: () => boolean = () => true,
  onBadge?: (notice: JobBoardBadgeNotice) => void,
): Promise<boolean> {
  const report = (text: string) => {
    if (isCurrent()) {
      onBadge?.({ scope: 'offer', text });
    }
  };
  const jobUrl = canonicalLinkedInJobUrl(pageUrl, null);
  const heading = isLinkedInJobViewPage(pageUrl)
    ? findStatusDemandHeading(doc)
    : null;

  if (!isLinkedInJobViewPage(pageUrl) || jobUrl === '') {
    clearOfferMarkers(doc);
    report('');
    return false;
  }

  if (heading === null) {
    clearOfferMarkers(doc);
    report(offerPageBadge({ applied: false, sheet: 'ok', saved: false }));
    return false;
  }

  if (!isCurrent()) {
    return false;
  }

  let response: unknown;

  try {
    response = await ask([jobUrl]);
  } catch {
    if (isCurrent()) {
      paintOfferProblem(heading, sheetProblemMessage({ status: 'error' }));
      report('!');
    }

    return false;
  }

  if (!isCurrent()) {
    return false;
  }

  const parsed = trackedApplicationsResultSchema.safeParse(response);
  const match =
    parsed.success && parsed.data.status === 'ok'
      ? parsed.data.matches.find((item) => item.url === jobUrl)
      : undefined;

  if (match === undefined) {
    paintOfferProblem(
      heading,
      sheetProblemMessage(
        parsed.success && parsed.data.status !== 'ok'
          ? parsed.data
          : { status: 'unread' },
      ),
    );
    report('!');
    return false;
  }

  paintOfferStatus(heading, match);
  report(
    offerPageBadge({
      applied: true,
      sheet: 'ok',
      saved: match.status === 'found',
    }),
  );
  return true;
}

function paintTrackerProblem(
  rows: readonly TrackerRow[],
  problem: string,
): void {
  const parents = new Set<HTMLElement>();
  const visual = problemVisual(problem);

  for (const row of rows) {
    const parent = markerParent(row.noteLink);

    if (parent === null) {
      continue;
    }

    parents.add(parent);
    renderSyncMarker(markerHost(parent), visual);
  }

  const doc = rows[0]?.noteLink.ownerDocument;

  if (doc === null || doc === undefined) {
    return;
  }

  for (const marker of queryDeep(doc, `[${SYNC_MARKER_ATTRIBUTE}]`)) {
    if (!parents.has(marker.parentElement as HTMLElement)) {
      marker.remove();
    }
  }
}

function paintOfferProblem(heading: HTMLElement, problem: string): void {
  renderSyncMarker(offerMarkerHost(heading), problemVisual(problem));
}

function visualForMatch(match: TrackedMatch): MarkerVisual {
  return {
    icon:
      match.status === 'found' && match.application !== undefined
        ? 'check'
        : 'cross',
    tooltip: syncTooltip(match),
  };
}

function problemVisual(problem: string): MarkerVisual {
  return { icon: 'info', tooltip: problem };
}

export function paintOfferStatus(
  heading: HTMLElement,
  match: TrackedMatch,
): void {
  const doc = heading.ownerDocument;

  for (const marker of doc.querySelectorAll(`[${OFFER_SYNC_ATTRIBUTE}]`)) {
    if (marker.parentElement !== heading) {
      marker.remove();
    }
  }

  renderSyncMarker(offerMarkerHost(heading), visualForMatch(match));
}

export function clearOfferMarkers(root: ParentNode): void {
  if (!('querySelectorAll' in root)) {
    return;
  }

  for (const marker of root.querySelectorAll(`[${OFFER_SYNC_ATTRIBUTE}]`)) {
    marker.remove();
  }
}

export function startOfferStatusSync(
  doc: Document,
  pageUrl: () => string,
  ask: (urls: readonly string[]) => Promise<unknown>,
  onBadge?: (notice: JobBoardBadgeNotice) => void,
): () => void {
  let generation = 0;
  let signature = '';
  const refresh = () => {
    const page = pageUrl();
    const heading = isLinkedInJobViewPage(page)
      ? findStatusDemandHeading(doc)
      : null;
    const jobUrl = heading === null ? '' : canonicalLinkedInJobUrl(page, null);

    if (heading === null || jobUrl === '') {
      signature = '';
      clearOfferMarkers(doc);
      onBadge?.({
        scope: 'offer',
        text: isLinkedInJobViewPage(page)
          ? offerPageBadge({ applied: false, sheet: 'ok', saved: false })
          : '',
      });
      return;
    }

    if (
      jobUrl === signature &&
      heading.querySelector(`:scope > [${OFFER_SYNC_ATTRIBUTE}]`) !== null
    ) {
      return;
    }

    const token = generation + 1;
    generation = token;
    void syncOfferStatusPage(
      doc,
      page,
      ask,
      () => token === generation,
      onBadge,
    ).then((painted) => {
      if (token === generation && painted) {
        signature = jobUrl;
      }
    });
  };
  let cancelIdle: (() => void) | null = null;
  const kick = () => {
    if (cancelIdle !== null) {
      return;
    }

    cancelIdle = scheduleIdle(doc, () => {
      cancelIdle = null;
      refresh();
    });
  };
  const stop = watchOfferHeading(doc, kick);
  const timer = setInterval(kick, 4000);

  kick();

  return () => {
    generation += 1;
    clearInterval(timer);
    cancelIdle?.();
    stop();
    clearOfferMarkers(doc);
  };
}

function offerMarkerHost(heading: HTMLElement): HTMLElement {
  const current = heading.querySelector(`:scope > [${OFFER_SYNC_ATTRIBUTE}]`);

  if (current instanceof HTMLElement) {
    return current;
  }

  const host = heading.ownerDocument.createElement('span');
  host.setAttribute(OFFER_SYNC_ATTRIBUTE, '');
  host.style.setProperty('display', 'inline-flex', 'important');
  host.style.setProperty('flex', '0 0 auto', 'important');
  host.style.setProperty('width', '16px', 'important');
  host.style.setProperty('height', '16px', 'important');
  host.style.setProperty('margin-left', '1rem', 'important');
  host.style.setProperty('vertical-align', 'middle', 'important');
  host.style.setProperty('position', 'relative', 'important');
  host.style.setProperty('z-index', '5', 'important');
  host.style.setProperty('visibility', 'visible', 'important');
  heading.append(host);

  return host;
}

function watchOfferHeading(doc: Document, onChange: () => void): () => void {
  return watchDocument(doc, onChange, mutationAffectsOffer, 800);
}

function watchDocument(
  doc: Document,
  onChange: () => void,
  affects: (mutation: MutationRecord) => boolean,
  debounceMs: number,
): () => void {
  const target = doc.body;

  if (target === null) {
    return () => undefined;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver((mutations) => {
    if (!mutations.some((mutation) => affects(mutation))) {
      return;
    }

    if (timer !== null) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  });

  observer.observe(target, { childList: true, subtree: true });

  return () => {
    observer.disconnect();

    if (timer !== null) {
      clearTimeout(timer);
    }
  };
}

function mutationAffectsOffer(mutation: MutationRecord): boolean {
  if (mutation.type !== 'childList') {
    return false;
  }

  return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => {
    if (!(node instanceof Element)) {
      return false;
    }

    if (
      node.hasAttribute(OFFER_SYNC_ATTRIBUTE) ||
      node.closest(`[${OFFER_SYNC_ATTRIBUTE}]`) !== null
    ) {
      return false;
    }

    return node.matches('h1, h2, h3, h4, p, span, div, strong');
  });
}

function uniqueRows(rows: readonly TrackerRow[]): TrackerRow[] {
  const seen = new Set<string>();

  return rows.filter((row) => {
    if (seen.has(row.jobUrl)) {
      return false;
    }

    seen.add(row.jobUrl);
    return true;
  });
}

function markersPresent(rows: readonly TrackerRow[]): boolean {
  return rows.every((row) => {
    const parent = markerParent(row.noteLink);

    return parent?.querySelector(`:scope > [${SYNC_MARKER_ATTRIBUTE}]`) != null;
  });
}

export function startJobsTrackerSync(
  doc: Document,
  pageUrl: () => string,
  ask: (urls: readonly string[]) => Promise<unknown>,
  onBadge?: (notice: JobBoardBadgeNotice) => void,
): () => void {
  let generation = 0;
  let signature = '';
  const refresh = () => {
    const page = pageUrl();

    if (!isAppliedJobsTrackerPage(page)) {
      signature = '';
      clearTrackerMarkers(doc);
      onBadge?.({ scope: 'tracker', text: '' });
      return;
    }

    const rows = readTrackerRows(doc);
    const next = rows.map((row) => row.jobUrl).join('|');

    if (next === signature && next !== '' && markersPresent(rows)) {
      return;
    }

    const token = generation + 1;
    generation = token;
    void syncTrackerPage(
      doc,
      page,
      ask,
      () => token === generation,
      onBadge,
    ).then((painted) => {
      if (token === generation && painted) {
        signature = next;
      }
    });
  };
  let cancelIdle: (() => void) | null = null;
  const kick = () => {
    if (cancelIdle !== null) {
      return;
    }

    cancelIdle = scheduleIdle(doc, () => {
      cancelIdle = null;
      refresh();
    });
  };
  const stop = watchTrackerList(doc, kick, 800);
  const timer = setInterval(kick, 4000);

  kick();

  return () => {
    generation += 1;
    clearInterval(timer);
    cancelIdle?.();
    stop();
    clearTrackerMarkers(doc);
  };
}

function scheduleIdle(doc: Document, run: () => void): () => void {
  const view = doc.defaultView;

  if (view !== null && typeof view.requestIdleCallback === 'function') {
    const id = view.requestIdleCallback(() => {
      run();
    });

    return () => {
      view.cancelIdleCallback(id);
    };
  }

  const id = setTimeout(run, 600);

  return () => {
    clearTimeout(id);
  };
}

export function watchTrackerList(
  doc: Document,
  onChange: () => void,
  debounceMs = 300,
): () => void {
  const target = doc.body;

  if (target === null) {
    return () => undefined;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer !== null) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  };
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutationAffectsTracker(mutation))) {
      schedule();
    }
  });

  observer.observe(target, { childList: true, subtree: true });

  return () => {
    observer.disconnect();

    if (timer !== null) {
      clearTimeout(timer);
    }
  };
}

function mutationAffectsTracker(mutation: MutationRecord): boolean {
  if (mutation.type !== 'childList') {
    return false;
  }

  return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => {
    if (!(node instanceof Element)) {
      return false;
    }

    if (
      node.hasAttribute(SYNC_MARKER_ATTRIBUTE) ||
      node.closest(`[${SYNC_MARKER_ATTRIBUTE}]`) !== null
    ) {
      return false;
    }

    return (
      node.matches('a, h2, button, [role="checkbox"]') ||
      node.querySelector(
        'a[href*="/jobs/view/"], h2, button, [role="checkbox"]',
      ) !== null
    );
  });
}

function markerParent(noteLink: HTMLElement): HTMLElement | null {
  const parent = noteLink.parentElement;

  if (parent === null) {
    return null;
  }

  if (parent instanceof HTMLAnchorElement) {
    return parent.parentElement;
  }

  return parent;
}

function markerHost(parent: HTMLElement): HTMLElement {
  const current = parent.querySelector(`:scope > [${SYNC_MARKER_ATTRIBUTE}]`);

  if (current instanceof HTMLElement) {
    return current;
  }

  const host = parent.ownerDocument.createElement('span');
  host.setAttribute(SYNC_MARKER_ATTRIBUTE, '');
  host.style.setProperty('display', 'inline-flex', 'important');
  host.style.setProperty('flex', '0 0 auto', 'important');
  host.style.setProperty('width', '16px', 'important');
  host.style.setProperty('height', '16px', 'important');
  host.style.setProperty('margin-left', '8px', 'important');
  host.style.setProperty('position', 'relative', 'important');
  host.style.setProperty('z-index', '5', 'important');
  host.style.setProperty('visibility', 'visible', 'important');
  host.style.setProperty('overflow', 'visible', 'important');
  parent.append(host);

  return host;
}

function renderSyncMarker(host: HTMLElement, visual: MarkerVisual): void {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = MARKER_CSS;
  const button = document.createElement('button');
  button.type = 'button';
  button.style.setProperty('--jt-color', markerColor(visual.icon));
  button.innerHTML = markerSvg(visual.icon);
  const tip = document.createElement('span');
  tip.className = visual.icon === 'info' ? 'tip wrap' : 'tip';
  tip.textContent = visual.tooltip;
  button.setAttribute('aria-label', tip.textContent);
  shadow.replaceChildren(style, button, tip);
}

function markerColor(icon: MarkerVisual['icon']): string {
  switch (icon) {
    case 'check':
      return '#065f46';
    case 'info':
      return '#1d4ed8';
    case 'cross':
      return '#b91c1c';
  }
}

function markerSvg(icon: MarkerVisual['icon']): string {
  switch (icon) {
    case 'check':
      return CHECK_SVG;
    case 'info':
      return INFO_SVG;
    case 'cross':
      return CROSS_SVG;
  }
}
