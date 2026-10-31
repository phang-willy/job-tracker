import { describe, expect, it } from 'vitest';
import { parseLinkedInPageTitle } from '@/src/domain/job-offer/page-title';

describe('parseLinkedInPageTitle', () => {
  it('reads the job and the company before the LinkedIn suffix', () => {
    expect(
      parseLinkedInPageTitle(
        'Junior Software Engineer | Opert Solutions | LinkedIn',
      ),
    ).toEqual({
      title: 'Junior Software Engineer',
      company: 'Opert Solutions',
      location: '',
    });
  });

  it('ignores a notification count in front of the title', () => {
    expect(
      parseLinkedInPageTitle('(3) Web Developer | NovaSpace | LinkedIn'),
    ).toEqual({
      title: 'Web Developer',
      company: 'NovaSpace',
      location: '',
    });
  });

  it('stays empty when the title is only the site name', () => {
    expect(parseLinkedInPageTitle('LinkedIn')).toEqual({
      title: '',
      company: '',
      location: '',
    });
  });

  it('splits a job, a company and a place from the public LinkedIn title', () => {
    expect(
      parseLinkedInPageTitle(
        'Junior Full Stack Developer (on behalf of client) at linq — Thessaloniki, Central Macedonia, Greece | LinkedIn Jobs',
      ),
    ).toEqual({
      title: 'Junior Full Stack Developer (on behalf of client)',
      company: 'linq',
      location: 'Thessaloniki, Central Macedonia, Greece',
    });
  });

  it('does not use a leading place as the job title', () => {
    expect(
      parseLinkedInPageTitle(
        'Thessaloniki, Central Macedonia, Greece | Junior Full Stack Developer (on behalf of client) | linq | LinkedIn',
      ),
    ).toEqual({
      title: 'Junior Full Stack Developer (on behalf of client)',
      company: 'linq',
      location: 'Thessaloniki, Central Macedonia, Greece',
    });
  });

  it('keeps a place-only title out of the job name', () => {
    expect(
      parseLinkedInPageTitle(
        'Thessaloniki, Central Macedonia, Greece | LinkedIn Jobs',
      ),
    ).toEqual({
      title: '',
      company: '',
      location: 'Thessaloniki, Central Macedonia, Greece',
    });
  });

  it('does not treat a job title that contains a comma as a place', () => {
    expect(
      parseLinkedInPageTitle(
        'Frontend Web Developer - HTML,CSS (Remote) | Quik Hire Staffing | LinkedIn',
      ),
    ).toEqual({
      title: 'Frontend Web Developer - HTML,CSS (Remote)',
      company: 'Quik Hire Staffing',
      location: '',
    });
  });

  it('reads a metropolitan area from the public title', () => {
    expect(
      parseLinkedInPageTitle(
        '🚀 Junior Web Developer – React & TypeScript at USG Professionals Belgium — Brussels Metropolitan Area | LinkedIn Jobs',
      ),
    ).toEqual({
      title: '🚀 Junior Web Developer – React & TypeScript',
      company: 'USG Professionals Belgium',
      location: 'Brussels Metropolitan Area',
    });
  });

  it('reads a leading country as the place and the next part as the job', () => {
    expect(
      parseLinkedInPageTitle(
        'France | Frontend Web Developer - HTML,CSS (Remote) | Quik Hire Staffing | LinkedIn',
      ),
    ).toEqual({
      title: 'Frontend Web Developer - HTML,CSS (Remote)',
      company: 'Quik Hire Staffing',
      location: 'France',
    });
  });
});
