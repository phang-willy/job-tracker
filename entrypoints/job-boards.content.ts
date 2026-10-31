import { extractActiveJobRequestSchema } from '@/src/application/dto/job-offer-messages';
import type { ActiveJobMessage } from '@/src/application/dto/job-offer-messages';
import { ExtractActiveJobOffer } from '@/src/application/use-cases/extract-active-job-offer';
import { applicationForLinkedInPage } from '@/src/domain/job-offer/application-status';
import type { JobBoardBadgeNotice } from '@/src/domain/job-offer/job-board-badge';
import {
  isAppliedJobsTrackerPage,
  isJobsTrackerPage,
  isLinkedInJobViewPage,
  isLinkedInUrl,
} from '@/src/domain/job-offer/platform';
import { LinkedInApplicationStatusDetector } from '@/src/infrastructure/platforms/linkedin/linkedin-application-status-detector';
import { LinkedInJobExtractor } from '@/src/infrastructure/platforms/linkedin/linkedin-job-extractor';
import {
  lookupTrackedApplications,
  startJobsTrackerSync,
  startOfferStatusSync,
} from '@/src/infrastructure/platforms/linkedin/tracker-sync-markers';
import { watchJobDetails } from '@/src/infrastructure/platforms/linkedin/watch-job-details';
import {
  isRecognizedJobBoardUrl,
  jobBoardMatches,
} from '@/src/infrastructure/platforms/supported-hosts';

export default defineContentScript({
  matches: [...jobBoardMatches],
  main(ctx) {
    if (!isLinkedInUrl(window.location.href)) {
      return;
    }

    const extract = new ExtractActiveJobOffer(new LinkedInJobExtractor());
    const detect = new LinkedInApplicationStatusDetector();
    const read = (): ActiveJobMessage => {
      try {
        const extracted = extract.execute(document, window.location.href);

        if (extracted.status !== 'detected' && extracted.status !== 'partial') {
          return extracted;
        }

        return {
          ...extracted,
          application: applicationForLinkedInPage(
            window.location.href,
            detect.detect(document),
          ),
        };
      } catch {
        return { status: 'error' };
      }
    };
    let latest: ActiveJobMessage = { status: 'not_found' };
    let watchingOffer = false;
    let stopWatch: () => void = () => undefined;
    const syncOfferWatch = () => {
      if (isJobsTrackerPage(window.location.href)) {
        if (watchingOffer) {
          stopWatch();
          stopWatch = () => undefined;
          watchingOffer = false;
        }

        return;
      }

      if (watchingOffer) {
        return;
      }

      watchingOffer = true;
      latest = read();
      stopWatch = watchJobDetails(document, () => {
        latest = read();
      });
    };

    syncOfferWatch();
    const offerTimer = setInterval(syncOfferWatch, 1000);
    const askSheet = (urls: readonly string[]) =>
      lookupTrackedApplications(
        (message) => browser.runtime.sendMessage(message),
        urls,
      );
    const publishBadge = badgePublisher();
    const stopTracker = startJobsTrackerSync(
      document,
      () => window.location.href,
      askSheet,
      publishBadge,
    );
    const stopOffer = startOfferStatusSync(
      document,
      () => window.location.href,
      askSheet,
      publishBadge,
    );

    const onMessage = (
      message: unknown,
      _sender: unknown,
      sendResponse: (response: unknown) => void,
    ) => {
      if (!extractActiveJobRequestSchema.safeParse(message).success) {
        return;
      }

      latest = read();
      sendResponse(latest);
      return true;
    };

    browser.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(() => {
      clearInterval(offerTimer);
      stopWatch();
      stopTracker();
      stopOffer();
      browser.runtime.onMessage.removeListener(onMessage);
      void browser.runtime
        .sendMessage({ type: 'set-job-board-badge', text: '' })
        .catch(() => undefined);
    });
  },
});

function badgePublisher(): (notice: JobBoardBadgeNotice) => void {
  let offerText = '';
  let trackerText = '';
  let posted = '';

  return (notice) => {
    if (notice.scope === 'offer') {
      offerText = notice.text;
    } else {
      trackerText = notice.text;
    }

    const page = window.location.href;
    const text = !isRecognizedJobBoardUrl(page)
      ? ''
      : isAppliedJobsTrackerPage(page)
        ? trackerText
        : isLinkedInJobViewPage(page)
          ? offerText
          : '';

    if (text === posted) {
      return;
    }

    posted = text;
    void browser.runtime
      .sendMessage({ type: 'set-job-board-badge', text })
      .catch(() => undefined);
  };
}
