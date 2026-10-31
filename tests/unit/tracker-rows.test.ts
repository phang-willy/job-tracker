import { afterEach, describe, expect, it } from 'vitest';
import {
  isAppliedJobsTrackerPage,
  isJobsTrackerPage,
} from '@/src/domain/job-offer/platform';
import { readTrackerRows } from '@/src/domain/job-offer/tracker-rows';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('readTrackerRows', () => {
  it('reads each applied job and ignores the header and the empty state', () => {
    document.body.innerHTML = `
      <div>
        <div role="checkbox" aria-label="Sélectionner tout"></div>
        <p>Offres d'emploi</p>
        <p>Mes relations</p>
        <p>Notes</p>
      </div>
      <div>
        <div role="checkbox" aria-label="Sélectionner Software Engineer Fullstack - CDI Paris - Theodo HealthTech"></div>
        <a href="https://www.linkedin.com/jobs/view/4372128087/">Software Engineer</a>
        <div>
          <a href="https://www.linkedin.com/jobs-tracker/?stage=applied">
            <svg id="add-small"></svg>
            <span>Ajouter une note</span>
          </a>
        </div>
      </div>
      <div>
        <div role="checkbox" aria-label="Sélectionner Développeur Fullstack"></div>
        <a href="https://www.linkedin.com/jobs/view/5522001100/?trk=public">Développeur</a>
        <div>
          <a href="https://www.linkedin.com/jobs-tracker/?stage=applied">
            <span>Ajouter une note</span>
          </a>
        </div>
      </div>
    `;

    expect(readTrackerRows(document).map((row) => row.jobUrl)).toEqual([
      'https://www.linkedin.com/jobs/view/4372128087/',
      'https://www.linkedin.com/jobs/view/5522001100/',
    ]);

    document.body.innerHTML = '<h2>Aucun résultat</h2>';
    expect(readTrackerRows(document)).toEqual([]);
  });

  it('reads the wide row and the narrow card for the same job', () => {
    document.body.innerHTML = `
      <div id="wide">
        <a href="https://www.linkedin.com/jobs/view/4372128087/">Software Engineer</a>
        <button type="button">
          <svg id="add-small"></svg>
          <span>Ajouter une note</span>
        </button>
      </div>
      <div id="narrow">
        <a href="https://www.linkedin.com/jobs/view/4372128087/">Software Engineer</a>
        <p>Notes</p>
        <a href="https://www.linkedin.com/jobs-tracker/?stage=applied">
          <span>Ajouter une note</span>
        </a>
      </div>
    `;

    const rows = readTrackerRows(document);

    expect(rows.map((row) => row.jobUrl)).toEqual([
      'https://www.linkedin.com/jobs/view/4372128087/',
      'https://www.linkedin.com/jobs/view/4372128087/',
    ]);
    expect(rows[0]?.noteLink.tagName).toBe('BUTTON');
    expect(rows[1]?.noteLink.closest('#narrow')).not.toBeNull();
  });

  it('reads a row rendered inside an open shadow tree', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <div>
        <div role="checkbox" aria-label="Sélectionner Software Engineer Fullstack - CDI Paris - Theodo HealthTech"></div>
        <a href="https://www.linkedin.com/jobs/view/4372128087/" target="_blank">Software Engineer</a>
        <div>
          <a href="https://www.linkedin.com/jobs-tracker/?stage=applied">
            <svg id="add-small"></svg>
            <span>Ajouter une note</span>
          </a>
        </div>
      </div>
    `;

    const rows = readTrackerRows(document);

    expect(rows.map((row) => row.jobUrl)).toEqual([
      'https://www.linkedin.com/jobs/view/4372128087/',
    ]);
    expect(rows[0]?.noteLink.textContent).toContain('Ajouter une note');
  });

  it('recognizes the jobs tracker listing', () => {
    expect(
      isJobsTrackerPage(
        'https://www.linkedin.com/jobs-tracker/?stage=applied&start=10',
      ),
    ).toBe(true);
    expect(
      isAppliedJobsTrackerPage(
        'https://www.linkedin.com/jobs-tracker/?stage=applied&start=10',
      ),
    ).toBe(true);
    expect(
      isAppliedJobsTrackerPage(
        'https://www.linkedin.com/jobs-tracker/?stage=saved',
      ),
    ).toBe(false);
    expect(
      isJobsTrackerPage('https://www.linkedin.com/jobs/view/4372128087/'),
    ).toBe(false);
  });
});
