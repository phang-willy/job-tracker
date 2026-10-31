import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { CONTRACT_TYPES } from '@/src/domain/job-offer/contract';
import { canonicalLinkedInJobUrl } from '@/src/domain/job-offer/normalizers/linkedin-url';
import type { JobOffer } from '@/src/domain/job-offer/job-offer';
import { Alert } from '@/src/presentation/components/ui/alert';
import { Card, CardContent } from '@/src/presentation/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/src/presentation/components/ui/form';
import { Input } from '@/src/presentation/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/presentation/components/ui/select';
import {
  applicationFormSchema,
  type ApplicationFormValues,
} from '@/src/presentation/popup/application-form-schema';
import type { ApplicationStatus } from '@/src/presentation/popup/application-view';

export function ApplicationForm({
  status,
  offer,
  notice,
  valuesRef,
}: {
  status: ApplicationStatus;
  offer: JobOffer | null;
  notice: string | null;
  valuesRef?: { current: (() => ApplicationFormValues) | null };
}) {
  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: valuesFromOffer(offer),
    mode: 'onTouched',
  });

  useEffect(() => {
    if (valuesRef == null) {
      return;
    }

    valuesRef.current = () => form.getValues();

    return () => {
      valuesRef.current = null;
    };
  }, [form, valuesRef]);

  return (
    <Card>
      <CardContent className="space-y-3">
        <OfferNotice status={status} notice={notice} />
        <Form {...form}>
          <form
            aria-label="Candidature"
            autoComplete="off"
            noValidate
            onSubmit={(event) => {
              void form.handleSubmit(() => undefined)(event);
            }}
          >
            <button
              type="submit"
              className="sr-only"
              tabIndex={-1}
              disabled={status === 'loading'}
            >
              Vérifier la candidature
            </button>
            <fieldset
              className="grid grid-cols-2 gap-3 border-0 p-0"
              disabled={status === 'loading'}
              aria-busy={status === 'loading'}
            >
              <TextField
                control={form.control}
                name="url"
                label="Lien"
                className="col-span-2"
                readOnly
              />
              <TextField
                control={form.control}
                name="company"
                label="Société"
                className="col-span-2"
              />
              <TextField control={form.control} name="country" label="Pays" />
              <TextField control={form.control} name="city" label="Ville" />
              <TextField
                control={form.control}
                name="region"
                label="Région"
                className="col-span-2"
              />
              <TextField
                control={form.control}
                name="title"
                label="Poste"
                className="col-span-2"
              />
              <FormField
                control={form.control}
                name="contractType"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Contrat</FormLabel>
                    <Select
                      value={field.value === '' ? undefined : field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger onBlur={field.onBlur}>
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONTRACT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <TextField
                control={form.control}
                name="monthlySalary"
                label="Salaire mensuel"
              />
              <TextField
                control={form.control}
                name="annualSalary"
                label="Salaire annuel"
              />
            </fieldset>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function TextField({
  control,
  name,
  label,
  className,
  readOnly = false,
}: {
  control: ReturnType<typeof useForm<ApplicationFormValues>>['control'];
  name:
    | 'url'
    | 'company'
    | 'country'
    | 'city'
    | 'region'
    | 'title'
    | 'monthlySalary'
    | 'annualSalary';
  label: string;
  className?: string;
  readOnly?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              readOnly={readOnly}
              className={readOnly ? 'bg-neutral-50' : undefined}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function OfferNotice({
  status,
  notice,
}: {
  status: ApplicationStatus;
  notice: string | null;
}) {
  if (notice === null) {
    return null;
  }

  if (status === 'error') {
    return <Alert variant="destructive">{notice}</Alert>;
  }

  if (status === 'partial') {
    return <Alert variant="warning">{notice}</Alert>;
  }

  if (status === 'unsupported') {
    return <Alert>{notice}</Alert>;
  }

  return (
    <p className="text-xs text-neutral-600" role="status">
      {notice}
    </p>
  );
}

function valuesFromOffer(offer: JobOffer | null): ApplicationFormValues {
  return {
    url: canonicalLinkedInJobUrl(offer?.url ?? '', null),
    company: offer?.company ?? '',
    country: offer?.country ?? '',
    city: offer?.city ?? '',
    region: offer?.region ?? '',
    title: offer?.title ?? '',
    monthlySalary: offer?.monthlySalary ?? '',
    annualSalary: offer?.annualSalary ?? '',
    contractType: offer?.contractType ?? '',
  };
}
