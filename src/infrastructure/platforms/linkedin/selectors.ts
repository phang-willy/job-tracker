export const LINKEDIN_BANNER_ID_PREFIX = 'JobDetails_ManageJobBanner_';

export const LINKEDIN_BANNER_ID = /^JobDetails_ManageJobBanner_(\d+)$/;

export const LINKEDIN_CHECK_ICON_ID = 'check-small';

export const LINKEDIN_SDUI_JOB_DETAILS =
  '[data-sdui-screen="com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails"]';

export const LINKEDIN_DETAIL_SELECTORS = [
  '.jobs-search__job-details--container',
  '.jobs-details__main-content',
  '.job-details-jobs-unified-top-card__container--two-pane',
] as const;

export const LINKEDIN_DETAIL_SELECTOR = LINKEDIN_DETAIL_SELECTORS.join(', ');
