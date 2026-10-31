import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractActiveJobOffer } from '@/src/application/use-cases/extract-active-job-offer';
import type { JobExtractionResult } from '@/src/application/dto/job-offer-messages';
import { LinkedInJobExtractor } from '@/src/infrastructure/platforms/linkedin/linkedin-job-extractor';

const pageUrl =
  'https://www.linkedin.com/jobs/search/?currentJobId=111&trackingId=abc';
const useCase = new ExtractActiveJobOffer(new LinkedInJobExtractor());

describe('LinkedInJobExtractor', () => {
  it('reads the active offer next to the banner and ignores the results list', () => {
    mount('linkedin-offer.html');
    const result = useCase.execute(document, pageUrl);

    expect(result).toMatchObject({
      status: 'detected',
      offer: {
        company: 'NovaSpace',
        title: 'Web Developer',
        city: 'Paris',
        region: 'Île-de-France',
        country: 'France',
        contractType: 'CDI',
        contractInferredFromFullTime: true,
        monthlySalary: '4792',
        annualSalary: '57504',
        url: 'https://www.linkedin.com/jobs/view/4475859401/',
      },
    });
  });

  it('keeps an explicit contract ahead of Temps plein', () => {
    mount('linkedin-offer.html');
    const offer = document.querySelector('.css-1a2b3c');
    const workplace = [...(offer?.querySelectorAll('svg + span') ?? [])].find(
      (span) => span.textContent?.includes('Hybride'),
    );

    expect(workplace).toBeDefined();
    if (workplace === undefined) {
      return;
    }

    workplace.textContent = 'CDD';
    const result = useCase.execute(document, pageUrl);

    expect(offerOf(result)?.contractType).toBe('CDD');
    expect(offerOf(result)?.contractInferredFromFullTime).toBe(false);
  });

  it('does not infer a CDI from Temps partiel', () => {
    mount('linkedin-offer.html');
    const button = [
      ...(document
        .querySelector('.css-1a2b3c')
        ?.querySelectorAll('svg + span') ?? []),
    ].find((item) => item.textContent?.includes('Temps plein'));

    expect(button).toBeDefined();
    if (button === undefined) {
      return;
    }

    button.textContent = 'Temps partiel';
    const result = useCase.execute(document, pageUrl);

    expect(offerOf(result)?.contractType).toBe('');
    expect(offerOf(result)?.contractInferredFromFullTime).toBe(false);
    expect(result.status).toBe('partial');
  });

  it('leaves missing fields empty', () => {
    mount('linkedin-offer.html');
    const location = [...document.querySelectorAll('.css-1a2b3c span')].find(
      (span) => span.textContent?.includes('Paris'),
    );
    location?.remove();
    document.querySelector('.css-1a2b3c a[href*="/company/"]')?.remove();
    document.title = '';

    const result = useCase.execute(document, pageUrl);

    expect(result.status).toBe('partial');
    expect(offerOf(result)).toMatchObject({
      company: '',
      city: '',
      country: '',
      title: 'Web Developer',
    });
  });

  it('does not read a decoy card when the offer markup is incomplete', () => {
    mount('linkedin-offer.html');
    document.querySelector('.css-1a2b3c')?.remove();
    document
      .getElementById('JobDetails_ManageJobBanner_4475859401')
      ?.nextElementSibling?.remove();

    const result = useCase.execute(document, pageUrl);

    expect(result.status).toBe('partial');
    expect(offerOf(result)).toMatchObject({
      company: 'NovaSpace',
      title: 'Web Developer',
      city: '',
      country: '',
      contractType: '',
      url: 'https://www.linkedin.com/jobs/view/4475859401/',
    });
  });

  it('still reads the offer after extra wrappers are inserted', () => {
    mount('linkedin-offer.html');
    const content = document.querySelector('.css-1a2b3c');
    const wrapper = document.createElement('div');

    expect(content).not.toBeNull();
    if (content === null) {
      return;
    }

    wrapper.className = 'inserted-wrapper';
    while (content.firstChild !== null) {
      wrapper.append(content.firstChild);
    }
    content.append(wrapper);

    expect(offerOf(useCase.execute(document, pageUrl))?.company).toBe(
      'NovaSpace',
    );
  });

  it('reads the offer that replaced the previous one', () => {
    const html = readFixture('linkedin-offer.html');
    mountHtml(html);
    const first = useCase.execute(document, pageUrl);

    mountHtml(
      html
        .replaceAll('4475859401', '5522001100')
        .replaceAll('NovaSpace', 'AstroLab')
        .replaceAll('Web Developer', 'Data Analyst')
        .replaceAll('Paris, Île-de-France, France', 'Berlin, Allemagne')
        .replaceAll('Temps plein', 'Stage'),
    );
    const second = useCase.execute(document, pageUrl);

    expect(offerOf(first)?.company).toBe('NovaSpace');
    expect(offerOf(second)).toMatchObject({
      company: 'AstroLab',
      title: 'Data Analyst',
      city: 'Berlin',
      country: 'Allemagne',
      contractType: 'Stage',
      contractInferredFromFullTime: false,
      url: 'https://www.linkedin.com/jobs/view/5522001100/',
    });
  });

  it('reads an offer that follows the banner wrapper instead of living inside it', () => {
    mount('linkedin-offer-cousin.html');

    expect(
      useCase.execute(
        document,
        'https://www.linkedin.com/jobs/search/?currentJobId=999',
      ),
    ).toMatchObject({
      status: 'detected',
      offer: {
        company: 'CousinCo',
        title: 'Cousin Role',
        city: 'Lyon',
        country: 'France',
        contractType: 'CDI',
        contractInferredFromFullTime: false,
        url: 'https://www.linkedin.com/jobs/view/42/',
      },
    });
  });

  it('falls back to the jobs detail pane when the banner id is absent', () => {
    mount('linkedin-offer-top-card.html');

    expect(useCase.execute(document, pageUrl)).toMatchObject({
      status: 'detected',
      offer: {
        company: 'NovaSpace',
        title: 'Web Developer',
        city: 'Paris',
        region: 'Île-de-France',
        country: 'France',
        contractType: 'CDI',
        url: 'https://www.linkedin.com/jobs/view/4475859401/',
      },
    });
  });

  it('reads Ville, Région, Pays from the paragraph line', () => {
    mount('linkedin-offer.html');
    const line = [...document.querySelectorAll('p > span')].find((span) =>
      span.textContent?.includes('Paris'),
    );

    expect(line).toBeDefined();
    if (line !== undefined) {
      line.textContent = 'Corbeil-Essonnes, Île-de-France, France';
    }

    expect(offerOf(useCase.execute(document, pageUrl))).toMatchObject({
      city: 'Corbeil-Essonnes',
      country: 'France',
    });
  });

  it('reads the job and the company from the page title', () => {
    mount('linkedin-offer.html');
    document.querySelector('.css-1a2b3c h1')?.remove();
    document.querySelector('.css-1a2b3c a[href*="/company/"]')?.remove();
    document.title = 'Junior Software Engineer | Opert Solutions | LinkedIn';

    expect(offerOf(useCase.execute(document, pageUrl))).toMatchObject({
      company: 'Opert Solutions',
      title: 'Junior Software Engineer',
    });
  });

  it('reads the poste from the head title rather than a page heading', () => {
    mount('linkedin-offer.html');
    const heading = document.querySelector('.css-1a2b3c h1');

    expect(heading).not.toBeNull();
    if (heading !== null) {
      heading.textContent = 'Offre recommandée';
    }

    document.title = 'Junior Software Engineer | Opert Solutions | LinkedIn';

    expect(offerOf(useCase.execute(document, pageUrl))?.title).toBe(
      'Junior Software Engineer',
    );
  });

  it('reads Brussels Metropolitan Area as Bruxelles, Belgique', () => {
    mount('linkedin-offer.html');
    const place = [...document.querySelectorAll('.css-1a2b3c span')].find(
      (span) => span.textContent?.includes('Paris'),
    );

    place?.remove();
    document.querySelector('.css-1a2b3c a[href*="/company/"]')?.remove();
    document.title =
      '🚀 Junior Web Developer – React & TypeScript at USG Professionals Belgium — Brussels Metropolitan Area | LinkedIn Jobs';

    expect(offerOf(useCase.execute(document, pageUrl))).toMatchObject({
      company: 'USG Professionals Belgium',
      title: '🚀 Junior Web Developer – React & TypeScript',
      city: 'Bruxelles',
      region: '',
      country: 'Belgique',
    });
  });

  it('reads the linq offer from a public title and keeps the place out of the poste', () => {
    mount('linkedin-offer.html');
    const heading = document.querySelector('.css-1a2b3c h1');
    const place = [...document.querySelectorAll('.css-1a2b3c span')].find(
      (span) => span.textContent?.includes('Paris'),
    );

    expect(heading).not.toBeNull();
    if (heading !== null) {
      heading.textContent = 'Thessaloniki';
    }
    place?.remove();
    document.querySelector('.css-1a2b3c a[href*="/company/"]')?.remove();
    document.title =
      'Junior Full Stack Developer (on behalf of client) at linq — Thessaloniki, Central Macedonia, Greece | LinkedIn Jobs';

    expect(offerOf(useCase.execute(document, pageUrl))).toMatchObject({
      company: 'linq',
      title: 'Junior Full Stack Developer (on behalf of client)',
      city: 'Thessaloniki',
      region: 'Central Macedonia',
      country: 'Greece',
      contractType: 'CDI',
    });
  });

  it('ignores the profile AI prompt and keeps the page title', () => {
    mount('linkedin-offer.html');
    const heading = document.querySelector('.css-1a2b3c h1');

    expect(heading).not.toBeNull();
    if (heading !== null) {
      heading.textContent =
        "Utilisez l'IA pour évaluer si votre profil correspond";
    }

    expect(offerOf(useCase.execute(document, pageUrl))?.title).toBe(
      'Web Developer',
    );
  });

  it('does not use a contract or salary pill as the job title', () => {
    mount('linkedin-offer.html');
    document.querySelector('.css-1a2b3c h1')?.remove();
    document.title = '';

    expect(offerOf(useCase.execute(document, pageUrl))?.title).toBe('');
  });

  it('keeps a single salary and leaves the cells empty without an amount', () => {
    mount('linkedin-offer.html');
    const salary = [...document.querySelectorAll('a > span > span')].find(
      (span) => span.textContent?.includes('€'),
    );

    expect(salary).toBeDefined();
    if (salary !== undefined) {
      salary.textContent = '48K € par an';
    }

    expect(offerOf(useCase.execute(document, pageUrl))).toMatchObject({
      monthlySalary: '4000',
      annualSalary: '48000',
    });

    salary?.remove();

    expect(offerOf(useCase.execute(document, pageUrl))).toMatchObject({
      monthlySalary: '',
      annualSalary: '',
    });
  });

  it('sets the city to Remote when the place is only a country and the offer is remote', () => {
    mountHtml(`
      <title>Frontend Web Developer at Quik Hire — France | LinkedIn</title>
      <body>
        <div>
          <div id="JobDetails_ManageJobBanner_4469604209"></div>
          <div>
            <a href="https://www.linkedin.com/company/quik-hire/">Quik Hire</a>
            <p><span>France</span></p>
            <a href="https://www.linkedin.com/jobs/view/4469604209/">
              <span>
                <svg id="check-small"></svg>
                <span>À distance</span>
              </span>
            </a>
            <a href="https://www.linkedin.com/jobs/view/4469604209/">
              <span>
                <svg id="check-small"></svg>
                <span>Temps plein</span>
              </span>
            </a>
          </div>
        </div>
      </body>
    `);

    expect(offerOf(useCase.execute(document, pageUrl))).toMatchObject({
      company: 'Quik Hire',
      title: 'Frontend Web Developer',
      city: 'Remote',
      region: '',
      country: 'France',
      contractType: 'CDI',
    });
  });

  it('keeps a comma inside the job title and a country-only remote place', () => {
    mountHtml(`
      <title>Frontend Web Developer - HTML,CSS (Remote) | Quik Hire Staffing | LinkedIn</title>
      <body>
        <div>
          <div id="JobDetails_ManageJobBanner_4467438805"></div>
          <div>
            <a href="https://www.linkedin.com/company/quik-hire-staffing/">Quik Hire Staffing</a>
            <h1>Frontend Web Developer - HTML,CSS (Remote)</h1>
            <p><span>France</span></p>
            <a href="https://www.linkedin.com/jobs/view/4467438805/">
              <span>
                <svg id="check-small"></svg>
                <span>À distance</span>
              </span>
            </a>
            <a href="https://www.linkedin.com/jobs/view/4467438805/">
              <span>
                <svg id="check-small"></svg>
                <span>Temps plein</span>
              </span>
            </a>
          </div>
        </div>
      </body>
    `);

    expect(
      offerOf(
        useCase.execute(
          document,
          'https://www.linkedin.com/jobs/view/4467438805/',
        ),
      ),
    ).toMatchObject({
      company: 'Quik Hire Staffing',
      title: 'Frontend Web Developer - HTML,CSS (Remote)',
      city: 'Remote',
      region: '',
      country: 'France',
      contractType: 'CDI',
    });
  });

  it('reads the search results detail screen and ignores the results list', () => {
    mountHtml(`
      <title>Web Developer | NovaSpace | LinkedIn</title>
      <body>
        <ul>
          <li>
            <a href="https://www.linkedin.com/company/otherco/">OtherCo</a>
            <span>Lyon, Auvergne-Rhône-Alpes, France</span>
            <a href="https://www.linkedin.com/jobs/view/1111111111/">
              <span>
                <svg id="check-small"></svg>
                <span>Stage</span>
              </span>
            </a>
          </li>
        </ul>
        <div data-sdui-screen="com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails">
          <a href="https://www.linkedin.com/company/novaspace/">NovaSpace</a>
          <h1>
            <a href="https://www.linkedin.com/jobs/view/4479874662/">Intitulé du panneau</a>
          </h1>
          <p><span>Paris, Île-de-France, France</span></p>
          <a href="https://www.linkedin.com/jobs/view/4479874662/">
            <span>
              <svg id="check-small"></svg>
              <span>À distance</span>
            </span>
          </a>
          <a href="https://www.linkedin.com/jobs/view/4479874662/">
            <span>
              <svg id="check-small"></svg>
              <span>Temps plein</span>
            </span>
          </a>
          <a href="https://www.linkedin.com/jobs/view/4479874662/">
            <span><span>55K € par yr - 60K € par yr</span></span>
          </a>
        </div>
      </body>
    `);

    expect(
      useCase.execute(
        document,
        'https://www.linkedin.com/jobs/search-results/?currentJobId=4479874662&trackingId=abc',
      ),
    ).toMatchObject({
      status: 'detected',
      offer: {
        company: 'NovaSpace',
        title: 'Web Developer',
        city: 'Paris',
        region: 'Île-de-France',
        country: 'France',
        contractType: 'CDI',
        contractInferredFromFullTime: true,
        monthlySalary: '4792',
        annualSalary: '57504',
        url: 'https://www.linkedin.com/jobs/view/4479874662/',
      },
    });
  });

  it('returns not_found on a LinkedIn page without an offer', () => {
    document.body.innerHTML = '<main><p>Fil</p></main>';
    document.title = 'Fil | LinkedIn';

    expect(useCase.execute(document, 'https://www.linkedin.com/feed/')).toEqual(
      { status: 'not_found' },
    );
  });
});

function mount(name: string): void {
  mountHtml(readFixture(name));
}

function mountHtml(html: string): void {
  document.body.innerHTML =
    /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  document.title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '';
}

function readFixture(name: string): string {
  return readFileSync(resolve('tests/fixtures/html', name), 'utf8');
}

function offerOf(result: JobExtractionResult) {
  return result.status === 'detected' || result.status === 'partial'
    ? result.offer
    : undefined;
}
