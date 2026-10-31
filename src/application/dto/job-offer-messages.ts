import { CONTRACT_TYPES } from '@/src/domain/job-offer/contract';
import { z } from '@/src/infrastructure/zod';

export const jobOfferSchema = z.object({
  company: z.string(),
  country: z.string(),
  region: z.string(),
  city: z.string(),
  title: z.string(),
  contractType: z.union([z.literal(''), z.enum(CONTRACT_TYPES)]),
  contractInferredFromFullTime: z.boolean(),
  monthlySalary: z.string(),
  annualSalary: z.string(),
  url: z.string(),
});

export const jobExtractionResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('detected'),
    offer: jobOfferSchema,
  }),
  z.object({
    status: z.literal('partial'),
    offer: jobOfferSchema,
  }),
  z.object({ status: z.literal('not_found') }),
  z.object({ status: z.literal('error') }),
]);

export const siteApplicationStatusSchema = z.object({
  state: z.enum(['applied', 'not_applied', 'unknown']),
  statusLabel: z.string(),
  relativeDate: z.string(),
});

export const activeJobMessageSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('detected'),
    offer: jobOfferSchema,
    application: siteApplicationStatusSchema,
  }),
  z.object({
    status: z.literal('partial'),
    offer: jobOfferSchema,
    application: siteApplicationStatusSchema,
  }),
  z.object({ status: z.literal('not_found') }),
  z.object({ status: z.literal('error') }),
]);

export const extractActiveJobRequestSchema = z.object({
  type: z.literal('extract-active-job'),
});

export type JobExtractionResult = z.infer<typeof jobExtractionResultSchema>;
export type SiteApplicationStatus = z.infer<typeof siteApplicationStatusSchema>;
export type ActiveJobMessage = z.infer<typeof activeJobMessageSchema>;
