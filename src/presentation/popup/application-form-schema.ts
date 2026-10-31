import { isContractType } from '@/src/domain/job-offer/contract';
import { z } from '@/src/infrastructure/zod';

export const applicationFormSchema = z.object({
  url: z.string().trim(),
  company: z.string().trim().min(1, 'Indique la société.'),
  country: z.string().trim().min(1, 'Indique le pays.'),
  city: z.string().trim().min(1, 'Indique la ville.'),
  region: z.string().trim(),
  title: z.string().trim().min(1, 'Indique le poste.'),
  monthlySalary: z.string().trim(),
  annualSalary: z.string().trim(),
  contractType: z.string().refine((value): boolean => isContractType(value), {
    message: 'Choisis un type de contrat.',
  }),
});

export type ApplicationFormValues = z.infer<typeof applicationFormSchema>;
