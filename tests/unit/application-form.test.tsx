import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { JobOffer } from '@/src/domain/job-offer/job-offer';
import { ApplicationForm } from '@/src/presentation/popup/ApplicationForm';
import { applicationFormSchema } from '@/src/presentation/popup/application-form-schema';

const offer: JobOffer = {
  company: 'NovaSpace',
  country: 'France',
  region: 'Île-de-France',
  city: 'Paris',
  title: 'Web Developer',
  contractType: 'CDI',
  contractInferredFromFullTime: true,
  monthlySalary: '4792',
  annualSalary: '57504',
  url: 'https://www.linkedin.com/jobs/view/web-developer-4475859401/?trackingId=abc',
};

describe('ApplicationForm', () => {
  it('prefills the fields and shows the normalized offer link', () => {
    render(
      <ApplicationForm
        status="detected"
        offer={offer}
        notice="Offre détectée"
      />,
    );

    const link = screen.getByLabelText('Lien');
    const company = screen.getByLabelText('Société');
    expect(link).toHaveValue('https://www.linkedin.com/jobs/view/4475859401/');
    expect(link).toHaveAttribute('readonly');
    expect(link.compareDocumentPosition(company)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(company).toHaveValue('NovaSpace');
    expect(screen.getByLabelText('Pays')).toHaveValue('France');
    const city = screen.getByLabelText('Ville');
    const region = screen.getByLabelText('Région');
    expect(city).toHaveValue('Paris');
    expect(city.compareDocumentPosition(region)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(region).toHaveValue('Île-de-France');
    expect(screen.getByLabelText('Poste')).toHaveValue('Web Developer');
    const contract = screen.getByRole('combobox', { name: 'Contrat' });
    const monthly = screen.getByLabelText('Salaire mensuel');
    const annual = screen.getByLabelText('Salaire annuel');
    expect(contract).toHaveTextContent('CDI');
    expect(contract.compareDocumentPosition(monthly)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(monthly).toHaveValue('4792');
    expect(monthly.compareDocumentPosition(annual)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(annual).toHaveValue('57504');
    expect(screen.queryByText(/Proposé à partir de/)).toBeNull();
    expect(screen.queryByDisplayValue(offer.url)).toBeNull();
  });

  it('lets every prefilled field be edited', async () => {
    const user = userEvent.setup();

    render(
      <ApplicationForm
        status="detected"
        offer={offer}
        notice="Offre détectée"
      />,
    );

    const company = screen.getByLabelText('Société');
    await user.clear(company);
    await user.type(company, 'Autre Société');
    expect(company).toHaveValue('Autre Société');

    const city = screen.getByLabelText('Ville');
    await user.clear(city);
    await user.type(city, 'Lyon');
    expect(city).toHaveValue('Lyon');

    const salary = screen.getByLabelText('Salaire mensuel');
    await user.clear(salary);
    await user.type(salary, '4200');
    expect(salary).toHaveValue('4200');

    const annual = screen.getByLabelText('Salaire annuel');
    await user.clear(annual);
    await user.type(annual, '50400');
    expect(annual).toHaveValue('50400');

    await user.click(screen.getByRole('combobox', { name: 'Contrat' }));
    await user.click(screen.getByRole('option', { name: 'CDD' }));

    expect(screen.getByRole('combobox', { name: 'Contrat' })).toHaveTextContent(
      'CDD',
    );
  });

  it('shows an empty field instead of a guessed value', () => {
    render(
      <ApplicationForm
        status="partial"
        offer={{
          ...offer,
          city: '',
          country: '',
          monthlySalary: '',
          annualSalary: '',
          contractType: '',
        }}
        notice="Certaines informations sont manquantes. Tu peux les compléter."
      />,
    );

    expect(screen.getByLabelText('Ville')).toHaveValue('');
    expect(screen.getByLabelText('Pays')).toHaveValue('');
    expect(screen.getByLabelText('Salaire mensuel')).toHaveValue('');
    expect(screen.getByLabelText('Salaire annuel')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Contrat' })).toHaveTextContent(
      'Choisir',
    );
    expect(
      screen.getByText(
        'Certaines informations sont manquantes. Tu peux les compléter.',
      ),
    ).toBeVisible();
  });

  it('shows the unsupported and error states', () => {
    const { rerender } = render(
      <ApplicationForm
        status="unsupported"
        offer={null}
        notice="Cette page n'est pas encore prise en charge."
      />,
    );

    expect(
      screen.getByText("Cette page n'est pas encore prise en charge."),
    ).toBeVisible();
    expect(screen.getByLabelText('Société')).toHaveValue('');

    rerender(
      <ApplicationForm
        status="error"
        offer={null}
        notice="Impossible de lire l'offre sur cette page."
      />,
    );
    expect(
      screen.getByText("Impossible de lire l'offre sur cette page."),
    ).toBeVisible();
  });

  it('validates the form with Zod', async () => {
    const user = userEvent.setup();

    render(<ApplicationForm status="partial" offer={null} notice={null} />);

    await user.click(screen.getByLabelText('Société'));
    await user.click(
      screen.getByRole('button', { name: 'Vérifier la candidature' }),
    );

    expect(await screen.findByText('Indique la société.')).toBeVisible();
    expect(screen.getByText('Indique le pays.')).toBeVisible();
    expect(screen.getByText('Indique la ville.')).toBeVisible();
    expect(screen.getByText('Indique le poste.')).toBeVisible();
    expect(screen.getByText('Choisis un type de contrat.')).toBeVisible();
    expect(
      applicationFormSchema.safeParse({
        company: 'NovaSpace',
        country: 'France',
        city: 'Paris',
        region: '',
        url: 'https://www.linkedin.com/jobs/view/4475859401/',
        title: 'Web Developer',
        monthlySalary: '',
        annualSalary: '57504',
        contractType: 'CDI',
      }).success,
    ).toBe(true);
    expect(
      applicationFormSchema.safeParse({
        company: '   ',
        country: 'France',
        city: 'Paris',
        region: 'Île-de-France',
        url: '',
        title: 'Web Developer',
        monthlySalary: '4792',
        annualSalary: '',
        contractType: 'Temps plein',
      }).success,
    ).toBe(false);
  });
});
