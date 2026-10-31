import type { ContractType } from '@/src/domain/job-offer/contract';

export type JobOffer = {
  company: string;
  country: string;
  region: string;
  city: string;
  title: string;
  contractType: ContractType | '';
  contractInferredFromFullTime: boolean;
  monthlySalary: string;
  annualSalary: string;
  url: string;
};
