import { describe, expect, it } from 'vitest';
import { applicationForLinkedInPage } from '@/src/domain/job-offer/application-status';
import { LinkedInApplicationStatusDetector } from '@/src/infrastructure/platforms/linkedin/linkedin-application-status-detector';

const detector = new LinkedInApplicationStatusDetector();

describe('LinkedInApplicationStatusDetector', () => {
  it('reads Candidature envoyée and keeps the relative date as text', () => {
    mount(`
      <div id="JobDetails_ManageJobBanner_4479813416"></div>
      <div>
        <h2>Statut de la demande</h2>
        <p>Candidature envoyée</p>
        <p>il y a 1 semaine</p>
      </div>
    `);

    expect(detector.detect(document)).toEqual({
      state: 'applied',
      statusLabel: 'Candidature envoyée',
      relativeDate: 'il y a 1 semaine',
    });
  });

  it('does not treat Postuler as proof that an application was sent', () => {
    mount(`
      <div id="JobDetails_ManageJobBanner_1"></div>
      <div><button type="button">Postuler</button></div>
    `);

    expect(detector.detect(document).state).toBe('not_applied');
  });

  it('does not treat Candidature simplifiée as a sent application', () => {
    mount(`
      <div id="JobDetails_ManageJobBanner_1"></div>
      <div><button type="button">Candidature simplifiée</button></div>
    `);

    expect(detector.detect(document).state).toBe('not_applied');
  });

  it('reads an apply link and a longer apply label as not sent', () => {
    mount(`
      <div id="JobDetails_ManageJobBanner_1"></div>
      <div><a href="/jobs/apply/">Candidature simplifiée</a></div>
    `);

    expect(detector.detect(document).state).toBe('not_applied');

    mount(`
      <section>
        <div>
          <button type="button" aria-label="Postuler sur le site de l'entreprise">
            <svg></svg>
          </button>
        </div>
        <div id="JobDetails_ManageJobBanner_1"></div>
      </section>
    `);

    expect(detector.detect(document).state).toBe('not_applied');
  });

  it('reads Postuler inside the search results detail screen', () => {
    mount(`
      <div data-sdui-screen="com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails">
        <a role="button"><span>Postuler</span></a>
      </div>
    `);

    expect(detector.detect(document).state).toBe('not_applied');
  });

  it('treats Statut de la demande as a sent application', () => {
    mount(`
      <div id="JobDetails_ManageJobBanner_4475027705"></div>
      <div>
        <h2>Statut de la demande</h2>
        <p>Candidature sur le site de l'entreprise</p>
      </div>
    `);

    expect(detector.detect(document)).toEqual({
      state: 'applied',
      statusLabel: 'Candidature envoyée',
      relativeDate: '',
    });
  });

  it('does not treat Enregistré as a sent application', () => {
    mount(`
      <div id="JobDetails_ManageJobBanner_1"></div>
      <div><button type="button">Enregistré</button></div>
    `);

    expect(detector.detect(document)).toEqual({
      state: 'unknown',
      statusLabel: '',
      relativeDate: '',
    });
  });

  it('stays unknown when the offer panel is incomplete', () => {
    mount(`<div id="JobDetails_ManageJobBanner_1"></div><div></div>`);

    expect(detector.detect(document).state).toBe('unknown');
  });

  it('follows the active offer when the status block is replaced', () => {
    mount(`
      <section>
        <div id="JobDetails_ManageJobBanner_10"></div>
        <div><button type="button">Postuler</button></div>
      </section>
    `);
    expect(detector.detect(document).state).toBe('not_applied');

    mount(`
      <section>
        <div id="JobDetails_ManageJobBanner_20"></div>
        <div>
          <h2>Statut de la demande</h2>
          <span>Candidature envoyée il y a 3 jours</span>
        </div>
      </section>
    `);

    expect(detector.detect(document)).toMatchObject({
      state: 'applied',
      relativeDate: 'il y a 3 jours',
    });
  });

  it('stops the relative date before a Voir link glued to the unit', () => {
    mount(
      '<div><div>Statut de la demande</div><div>Candidature envoyée il y a 4 mois<a href="#">Voir</a></div></div>',
    );

    expect(detector.detect(document)).toEqual({
      state: 'applied',
      statusLabel: 'Candidature envoyée',
      relativeDate: 'il y a 4 mois',
    });
  });

  it('reads a sent application when the status label is not a heading', () => {
    mount(`
      <div>
        <div>Statut de la demande</div>
        <div>
          <span>Candidature envoyée</span>
          <span>il y a 2 jours</span>
        </div>
      </div>
    `);

    expect(detector.detect(document)).toEqual({
      state: 'applied',
      statusLabel: 'Candidature envoyée',
      relativeDate: 'il y a 2 jours',
    });
  });

  it('ignores a Postuler button outside the active offer', () => {
    mount(`
      <ul><li><button type="button">Postuler</button></li></ul>
      <div id="JobDetails_ManageJobBanner_1"></div>
      <div>
        <h2>Statut de la demande</h2>
        <p>Candidature envoyée</p>
      </div>
    `);

    expect(detector.detect(document).state).toBe('applied');
  });

  it('treats a search results job as not applied', () => {
    expect(
      applicationForLinkedInPage(
        'https://www.linkedin.com/jobs/search-results/?currentJobId=4479874662',
        {
          state: 'applied',
          statusLabel: 'Candidature envoyée',
          relativeDate: 'il y a 1 semaine',
        },
      ),
    ).toEqual({ state: 'not_applied', statusLabel: '', relativeDate: '' });
    expect(
      applicationForLinkedInPage('https://www.linkedin.com/jobs/view/1/', {
        state: 'applied',
        statusLabel: 'Candidature envoyée',
        relativeDate: 'il y a 1 semaine',
      }).state,
    ).toBe('applied');
  });
});

function mount(html: string): void {
  document.body.innerHTML = html;
  document.title = '';
}
