import { z } from 'zod';

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
  }),
  z.object({ status: z.literal('invalid_url') }),
  z.object({ status: z.literal('unauthenticated') }),
  z.object({ status: z.literal('oauth_not_configured') }),
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
]);

export type ValidateSpreadsheetResult = z.infer<
  typeof validateSpreadsheetResultSchema
>;
export type SavedSpreadsheetSettings = z.infer<
  typeof savedSpreadsheetSettingsSchema
>;
