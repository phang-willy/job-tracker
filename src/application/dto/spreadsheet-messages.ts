import { z } from '@/src/infrastructure/zod';

export const structureProblemSchema = z.discriminatedUnion('code', [
  z.object({ code: z.literal('no_annual_sheet') }),
  z.object({
    code: z.literal('header_mismatch'),
    sheet: z.string(),
    column: z.string(),
    expected: z.string(),
    actual: z.string(),
  }),
  z.object({
    code: z.literal('missing_validation'),
    sheet: z.string(),
    column: z.enum(['Pays', 'Type', 'CV', 'Statut']),
  }),
]);

export const yearCheckSchema = z.object({
  year: z.string(),
  status: z.enum(['ok', 'invalid', 'missing']),
});

export const savedSpreadsheetSettingsSchema = z.object({
  spreadsheetId: z.string(),
  url: z.string(),
  title: z.string(),
  annualSheets: z.array(z.string()),
  writeAccess: z.enum(['unverified', 'verified', 'denied']),
  years: z.array(yearCheckSchema).default([]),
});

export const validateSpreadsheetResultSchema = z.discriminatedUnion('status', [
  savedSpreadsheetSettingsSchema.extend({
    status: z.literal('compatible'),
  }),
  z.object({
    status: z.literal('incompatible'),
    spreadsheetId: z.string(),
    title: z.string(),
    problems: z.array(structureProblemSchema),
    years: z.array(yearCheckSchema),
  }),
  z.object({
    status: z.literal('access_denied'),
    spreadsheetId: z.string(),
    cause: z.literal('sheets_api_disabled').optional(),
    notFound: z.literal(true).optional(),
  }),
  z.object({ status: z.literal('invalid_url') }),
  z.object({ status: z.literal('unauthenticated') }),
  z.object({ status: z.literal('oauth_not_configured') }),
  z.object({
    status: z.literal('unavailable'),
    detail: z.string().optional(),
  }),
]);

export const existingApplicationSchema = z.object({
  sheet: z.string(),
  row: z.number(),
  lastRow: z.number(),
  url: z.string(),
  status: z.string(),
  appliedOn: z.string(),
});

export const applicationDraftSchema = z.object({
  company: z.string(),
  country: z.string(),
  region: z.string(),
  city: z.string(),
  title: z.string(),
  monthlySalary: z.string(),
  annualSalary: z.string(),
  appliedOn: z.string(),
  contractType: z.string(),
  url: z.string(),
});

export const linkApplicationResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('found'),
    application: existingApplicationSchema,
  }),
  z.object({
    status: z.literal('invalid'),
    field: z.enum(['company', 'title', 'url', 'date']),
  }),
  z.object({ status: z.literal('missing_sheet'), year: z.string() }),
  z.object({ status: z.literal('incompatible_sheet'), year: z.string() }),
  z.object({ status: z.literal('unsorted') }),
  z.object({ status: z.literal('unconfirmed') }),
  z.object({ status: z.literal('not_configured') }),
  z.object({ status: z.literal('unauthenticated') }),
  z.object({ status: z.literal('oauth_not_configured') }),
  z.object({
    status: z.literal('access_denied'),
    cause: z.literal('sheets_api_disabled').optional(),
  }),
  z.object({ status: z.literal('denied') }),
  z.object({
    status: z.literal('unavailable'),
    detail: z.string().optional(),
  }),
]);

export const existingApplicationResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('found'),
    application: existingApplicationSchema,
  }),
  z.object({ status: z.literal('missing') }),
  z.object({ status: z.literal('not_configured') }),
  z.object({ status: z.literal('unauthenticated') }),
  z.object({ status: z.literal('oauth_not_configured') }),
  z.object({ status: z.literal('access_denied') }),
  z.object({
    status: z.literal('unavailable'),
    detail: z.string().optional(),
  }),
]);

export const trackedMatchSchema = z.discriminatedUnion('status', [
  z.object({
    url: z.string(),
    status: z.literal('missing'),
  }),
  z.object({
    url: z.string(),
    status: z.literal('found'),
    application: existingApplicationSchema,
  }),
]);

export const trackedApplicationsResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    matches: z.array(trackedMatchSchema),
  }),
  z.object({ status: z.literal('not_configured') }),
  z.object({ status: z.literal('unauthenticated') }),
  z.object({ status: z.literal('oauth_not_configured') }),
  z.object({ status: z.literal('access_denied') }),
  z.object({
    status: z.literal('unavailable'),
    detail: z.string().optional(),
  }),
]);

export const spreadsheetMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('validate-spreadsheet'),
    url: z.string(),
  }),
  z.object({
    type: z.literal('get-spreadsheet-settings'),
  }),
  z.object({
    type: z.literal('clear-spreadsheet-settings'),
  }),
  z.object({
    type: z.literal('find-existing-application'),
    url: z.string(),
  }),
  z.object({
    type: z.literal('match-applications'),
    urls: z.array(z.string()).max(30),
  }),
  z.object({
    type: z.literal('link-application'),
    application: applicationDraftSchema,
  }),
]);

export type ValidateSpreadsheetResult = z.infer<
  typeof validateSpreadsheetResultSchema
>;
export type SavedSpreadsheetSettings = z.infer<
  typeof savedSpreadsheetSettingsSchema
>;
export type LinkApplicationResult = z.infer<typeof linkApplicationResultSchema>;
