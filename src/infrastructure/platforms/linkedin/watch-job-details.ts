import {
  LINKEDIN_DETAIL_SELECTOR,
  LINKEDIN_SDUI_JOB_DETAILS,
} from '@/src/infrastructure/platforms/linkedin/selectors';

const BANNER_SELECTOR = '[id^="JobDetails_ManageJobBanner_"]';

export function watchJobDetails(
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
    if (
      mutations.some((mutation) => mutationConcernsActiveJob(mutation, doc))
    ) {
      schedule();
    }
  });

  observer.observe(target, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  return () => {
    observer.disconnect();

    if (timer !== null) {
      clearTimeout(timer);
    }
  };
}

function mutationConcernsActiveJob(
  mutation: MutationRecord,
  doc: Document,
): boolean {
  const nodes = [
    mutation.target,
    ...mutation.addedNodes,
    ...mutation.removedNodes,
  ];

  return nodes.some((node) => nodeConcernsActiveJob(node, doc));
}

function nodeConcernsActiveJob(node: Node, doc: Document): boolean {
  if (containsBannerId(node)) {
    return true;
  }

  const element = node instanceof Element ? node : node.parentElement;

  if (element === null) {
    return false;
  }

  const banner = doc.querySelector(BANNER_SELECTOR);

  if (banner instanceof Element) {
    return isAfterBanner(banner, element);
  }

  return (
    element.closest(LINKEDIN_DETAIL_SELECTOR) !== null ||
    element.closest(LINKEDIN_SDUI_JOB_DETAILS) !== null
  );
}

function containsBannerId(node: Node): boolean {
  if (!(node instanceof Element)) {
    return false;
  }

  return (
    node.id.startsWith('JobDetails_ManageJobBanner_') ||
    node.querySelector(BANNER_SELECTOR) !== null
  );
}

function isAfterBanner(banner: Element, element: Element): boolean {
  const parent = banner.parentElement;

  if (parent === null || !parent.contains(element)) {
    return false;
  }

  if (banner === element || banner.contains(element)) {
    return true;
  }

  return (
    (banner.compareDocumentPosition(element) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
    0
  );
}
