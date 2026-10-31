import { describe, expect, it } from 'vitest';
import {
  applicationView,
  hasRecognizedJobLink,
} from '@/src/presentation/popup/application-view';

describe('applicationView', () => {
  it('describes an unsupported page without inventing an offer', () => {
    expect(applicationView({ page: 'other' })).toEqual({
      status: 'unsupported',
      offer: null,
      application: null,
      notice: "Cette page n'est pas encore prise en charge.",
    });
  });

  it('describes a detected offer and a partial extraction', () => {
    const application = {
      state: 'not_applied' as const,
      statusLabel: '',
      relativeDate: '',
    };
    const offer = {
      company: 'NovaSpace',
      country: 'France',
      region: 'Île-de-France',
      city: 'Paris',
      title: 'Web Developer',
      contractType: 'CDI' as const,
      contractInferredFromFullTime: true,
      monthlySalary: '',
      annualSalary: '',
      url: 'https://www.linkedin.com/jobs/view/4475859401',
    };

    expect(
      applicationView({
        page: 'linkedin',
        extraction: { status: 'detected', offer, application },
      }).status,
    ).toBe('detected');
    expect(
      applicationView({
        page: 'linkedin',
        extraction: {
          status: 'partial',
          offer: { ...offer, city: '', country: '' },
          application,
        },
      }),
    ).toMatchObject({
      status: 'partial',
      notice: 'Certaines informations sont manquantes. Tu peux les compléter.',
    });
    expect(
      hasRecognizedJobLink(
        applicationView({
          page: 'linkedin',
          extraction: { status: 'detected', offer, application },
        }),
      ),
    ).toBe(true);
  });

  it('turns a missing offer or a failed message into the matching state', () => {
    expect(
      applicationView({ page: 'linkedin', extraction: { status: 'not_found' } })
        .status,
    ).toBe('unsupported');
    expect(
      applicationView({ page: 'linkedin', extraction: 'unreachable' }).status,
    ).toBe('error');
    expect(
      hasRecognizedJobLink(
        applicationView({
          page: 'linkedin',
          extraction: { status: 'not_found' },
        }),
      ),
    ).toBe(false);
  });
});
