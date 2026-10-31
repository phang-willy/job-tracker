import type {
  ApplicationCatalogRead,
  ApplicationInsertResult,
  SpreadsheetRead,
  WriteProbe,
} from '@/src/application/ports/spreadsheet';
import {
  columnInsertionIndex,
  filledColumnLength,
  type StoredApplication,
} from '@/src/domain/spreadsheet/applications';
import {
  applicationCells,
  type ApplicationDraft,
} from '@/src/domain/spreadsheet/application-draft';
import { civilDatesFromColumn } from '@/src/domain/spreadsheet/sheet-date';
import { titlesToVerify } from '@/src/domain/spreadsheet/structure';
import {
  annualSheetId,
  applicationWriteRequests,
  isSheetFormula,
} from '@/src/infrastructure/google/application-write-request';
import {
  annualSheetTitles,
  mapAnnualSheetGrid,
  quoteSheetRange,
  type SpreadsheetMetadata,
} from '@/src/infrastructure/google/map-spreadsheet-structure';
import {
  isMissingOAuthClient,
  type GoogleAuthGateway,
} from '@/src/infrastructure/google/chrome-google-auth';
import { logVerify } from '@/src/infrastructure/logging/verify-log';

type FetchLike = typeof fetch;

export class GoogleSheetsGateway {
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly auth: GoogleAuthGateway,
    fetchImpl?: FetchLike,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  async readStructure(spreadsheetId: string): Promise<SpreadsheetRead> {
    const token = await this.accessToken();

    logVerify('auth', describeToken(token));

    if (token.status !== 'ok') {
      return token;
    }

    const metadata = await this.getJson<SpreadsheetMetadata>(
      token.token,
      spreadsheetId,
      new URLSearchParams({
        fields: 'properties.title,sheets.properties.title',
      }),
    );

    if (metadata.status !== 'ok') {
      return metadata;
    }

    const annualTitles = annualSheetTitles(metadata.body);
    const titles = titlesToVerify(annualTitles, this.now().getFullYear());

    if (titles.length === 0) {
      return {
        status: 'ok',
        title: metadata.body.properties?.title ?? '',
        annualTitles,
        sheets: [],
      };
    }

    const params = new URLSearchParams({
      fields:
        'sheets(properties.title,data(rowData(values(formattedValue,dataValidation))))',
    });

    for (const title of titles) {
      params.append('ranges', quoteSheetRange(title));
    }

    const grid = await this.getJson<{
      sheets?: Parameters<typeof mapAnnualSheetGrid>[0][];
    }>(token.token, spreadsheetId, params);

    if (grid.status !== 'ok') {
      return grid;
    }

    return {
      status: 'ok',
      title: metadata.body.properties?.title ?? '',
      annualTitles,
      sheets: (grid.body.sheets ?? []).flatMap((sheet) => {
        const mapped = mapAnnualSheetGrid(sheet);

        return mapped === null ? [] : [mapped];
      }),
    };
  }

  async listApplications(
    spreadsheetId: string,
  ): Promise<ApplicationCatalogRead> {
    return this.readApplications(spreadsheetId, true);
  }

  private async readApplications(
    spreadsheetId: string,
    allowRefresh: boolean,
  ): Promise<ApplicationCatalogRead> {
    const token = await this.accessToken();

    if (token.status !== 'ok') {
      return token;
    }

    const listed = await this.fetchApplications(spreadsheetId, token.token);

    if (listed.status === 'unauthenticated' && allowRefresh) {
      return this.readApplications(spreadsheetId, false);
    }

    return listed;
  }

  private async fetchApplications(
    spreadsheetId: string,
    token: string,
  ): Promise<ApplicationCatalogRead> {
    const metadata = await this.getJson<SpreadsheetMetadata>(
      token,
      spreadsheetId,
      new URLSearchParams({ fields: 'sheets.properties.title' }),
    );

    if (metadata.status !== 'ok') {
      return metadata;
    }

    const titles = annualSheetTitles(metadata.body);

    if (titles.length === 0) {
      return { status: 'ok', rows: [] };
    }

    const formatted = await this.getValues(
      token,
      spreadsheetId,
      titles.flatMap((title) => [
        quoteColumnRange(title, 'A'),
        quoteColumnRange(title, 'H'),
        quoteColumnRange(title, 'N'),
        quoteColumnRange(title, 'O'),
      ]),
      'FORMATTED_VALUE',
    );

    if (formatted.status !== 'ok') {
      return formatted;
    }

    const formulas = await this.getValues(
      token,
      spreadsheetId,
      titles.map((title) => quoteColumnRange(title, 'N')),
      'FORMULA',
    );
    const formulaRanges =
      formulas.status === 'ok' ? (formulas.body.valueRanges ?? []) : [];
    const hyperlinks = await this.columnHyperlinks(
      token,
      spreadsheetId,
      titles,
    );
    const valueRanges = formatted.body.valueRanges ?? [];

    return {
      status: 'ok',
      rows: titles.flatMap((title, index) => {
        const base = index * 4;

        return applicationRows(
          title,
          valueRanges[base]?.values ?? [],
          valueRanges[base + 1]?.values ?? [],
          valueRanges[base + 2]?.values ?? [],
          valueRanges[base + 3]?.values ?? [],
          formulaRanges[index]?.values ?? [],
          hyperlinks.get(title) ?? [],
        );
      }),
    };
  }

  async insertApplication(
    spreadsheetId: string,
    draft: ApplicationDraft,
  ): Promise<ApplicationInsertResult> {
    return this.writeApplication(spreadsheetId, draft, true);
  }

  async probeWriteAccess(spreadsheetId: string): Promise<WriteProbe> {
    const token = await this.accessToken();

    logVerify('auth', describeToken(token));

    if (token.status !== 'ok') {
      return token;
    }

    const params = new URLSearchParams({
      fields: 'capabilities(canEdit)',
      supportsAllDrives: 'true',
    });
    const sent = await this.request(
      token.token,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?${params}`,
    );

    if (sent.status !== 'ok') {
      return { status: 'unverified' };
    }

    if (sent.response.status === 401) {
      await this.auth.invalidateAccessToken(token.token);
      return { status: 'unauthenticated' };
    }

    if (!sent.response.ok) {
      return { status: 'unverified' };
    }

    try {
      const body = (await sent.response.json()) as {
        capabilities?: { canEdit?: unknown };
      };

      if (body.capabilities?.canEdit === true) {
        return { status: 'ok' };
      }

      if (body.capabilities?.canEdit === false) {
        return { status: 'denied' };
      }
    } catch {
      return { status: 'unverified' };
    }

    return { status: 'unverified' };
  }

  private async writeApplication(
    spreadsheetId: string,
    draft: ApplicationDraft,
    allowRefresh: boolean,
  ): Promise<ApplicationInsertResult> {
    const capability = await this.probeWriteAccess(spreadsheetId);

    if (capability.status === 'denied') {
      return { status: 'denied' };
    }

    if (capability.status === 'unauthenticated' && allowRefresh) {
      return this.writeApplication(spreadsheetId, draft, false);
    }

    if (
      capability.status === 'unauthenticated' ||
      capability.status === 'oauth_not_configured'
    ) {
      return capability;
    }

    const token = await this.accessToken();

    if (token.status !== 'ok') {
      return token.status === 'unauthenticated' && allowRefresh
        ? this.writeApplication(spreadsheetId, draft, false)
        : token;
    }

    const prepared = await this.prepareApplicationWrite(
      spreadsheetId,
      token.token,
      draft,
    );

    if (prepared.status === 'unauthenticated' && allowRefresh) {
      return this.writeApplication(spreadsheetId, draft, false);
    }

    if (prepared.status !== 'ready') {
      return prepared;
    }

    const sent = await this.request(
      token.token,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      JSON.stringify({ requests: prepared.requests }),
    );

    if (sent.status !== 'ok') {
      return sent;
    }

    if (
      sent.response.status === 403 &&
      !(await sheetsApiDisabled(sent.response.clone()))
    ) {
      return { status: 'denied' };
    }

    const failure = await this.failureStatus(sent.response, token.token);

    if (failure?.status === 'unauthenticated' && allowRefresh) {
      return this.writeApplication(spreadsheetId, draft, false);
    }

    return failure ?? { status: 'inserted' };
  }

  private async prepareApplicationWrite(
    spreadsheetId: string,
    token: string,
    draft: ApplicationDraft,
  ): Promise<
    | { status: 'ready'; requests: object[] }
    | Exclude<ApplicationInsertResult, { status: 'inserted' | 'denied' }>
  > {
    const year = draft.appliedOn.slice(0, 4);
    const metadata = await this.getJson<{
      sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
    }>(
      token,
      spreadsheetId,
      new URLSearchParams({ fields: 'sheets.properties(title,sheetId)' }),
    );

    if (metadata.status !== 'ok') {
      return metadata;
    }

    const sheetId = annualSheetId(metadata.body.sheets ?? [], year);

    if (sheetId == null) {
      return { status: 'missing_sheet', year };
    }

    const dates = await this.getValues(
      token,
      spreadsheetId,
      [quoteColumnRange(year, 'H')],
      'UNFORMATTED_VALUE',
    );

    if (dates.status !== 'ok') {
      return dates;
    }

    const column = civilDatesFromColumn(
      dates.body.valueRanges?.[0]?.values as unknown[][] | undefined,
    );
    const index = columnInsertionIndex(column, draft.appliedOn);

    if (index == null) {
      return { status: 'unsorted' };
    }

    const dateCount = filledColumnLength(column);
    const referenceIndex = dateCount === 0 ? null : index === 0 ? 2 : index;
    const formulas =
      referenceIndex == null
        ? null
        : await this.getValues(
            token,
            spreadsheetId,
            [quoteColumnRange(year, 'G')],
            'FORMULA',
          );

    if (formulas != null && formulas.status !== 'ok') {
      return formulas;
    }

    const formulaRow = index === 0 ? 0 : (referenceIndex ?? 1) - 1;
    const formula = (
      formulas?.body.valueRanges?.[0]?.values as unknown[][] | undefined
    )?.[formulaRow]?.[0];
    const copyFormula = isSheetFormula(formula);

    return {
      status: 'ready',
      requests: applicationWriteRequests({
        sheetId,
        destinationIndex: index + 1,
        insertRow: index < dateCount,
        referenceIndex,
        copyFormula,
        cells: applicationCells(draft, { includeAnnualSalary: !copyFormula }),
      }),
    };
  }

  private async accessToken(): Promise<
    { status: 'ok'; token: string } | Exclude<SpreadsheetRead, { status: 'ok' }>
  > {
    try {
      return { status: 'ok', token: await this.auth.getAccessToken() };
    } catch (error) {
      logVerify('auth.error', error);

      if (isMissingOAuthClient(error)) {
        return { status: 'oauth_not_configured' };
      }

      return { status: 'unauthenticated' };
    }
  }

  private async getValues(
    token: string,
    spreadsheetId: string,
    ranges: readonly string[],
    valueRenderOption: 'FORMATTED_VALUE' | 'FORMULA' | 'UNFORMATTED_VALUE',
  ): Promise<
    | {
        status: 'ok';
        body: { valueRanges?: Array<{ values?: string[][] }> };
      }
    | Exclude<SpreadsheetRead, { status: 'ok' }>
  > {
    const params = new URLSearchParams({
      majorDimension: 'ROWS',
      valueRenderOption,
    });

    for (const range of ranges) {
      params.append('ranges', range);
    }

    return this.getAbsoluteJson(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params}`,
    );
  }

  private async columnHyperlinks(
    token: string,
    spreadsheetId: string,
    titles: readonly string[],
  ): Promise<Map<string, string[]>> {
    const params = new URLSearchParams({
      fields: 'sheets(properties.title,data(rowData(values(hyperlink))))',
    });

    for (const title of titles) {
      params.append('ranges', quoteLinkRange(title));
    }

    const listed = await this.getJson<{
      sheets?: Array<{
        properties?: { title?: string };
        data?: Array<{
          rowData?: Array<{
            values?: Array<{ hyperlink?: string }>;
          }>;
        }>;
      }>;
    }>(token, spreadsheetId, params);

    if (listed.status !== 'ok') {
      return new Map();
    }

    return new Map(
      (listed.body.sheets ?? []).map((sheet) => [
        sheet.properties?.title ?? '',
        (sheet.data?.[0]?.rowData ?? []).map(
          (row) => row.values?.[0]?.hyperlink?.trim() ?? '',
        ),
      ]),
    );
  }

  private async getJson<T>(
    token: string,
    spreadsheetId: string,
    params: URLSearchParams,
  ): Promise<
    { status: 'ok'; body: T } | Exclude<SpreadsheetRead, { status: 'ok' }>
  > {
    const sent = await this.request(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?${params}`,
    );

    if (sent.status !== 'ok') {
      return sent;
    }

    const response = sent.response;
    const failure = await this.failureStatus(response, token);

    if (failure != null) {
      return failure;
    }

    try {
      return { status: 'ok', body: (await response.json()) as T };
    } catch {
      return { status: 'unavailable' };
    }
  }

  private async getAbsoluteJson<T>(
    token: string,
    url: string,
  ): Promise<
    { status: 'ok'; body: T } | Exclude<SpreadsheetRead, { status: 'ok' }>
  > {
    const sent = await this.request(token, url);

    if (sent.status !== 'ok') {
      return sent;
    }

    const failure = await this.failureStatus(sent.response, token);

    if (failure != null) {
      return failure;
    }

    try {
      return { status: 'ok', body: (await sent.response.json()) as T };
    } catch {
      return { status: 'unavailable' };
    }
  }

  private async failureStatus(
    response: Response,
    token: string,
  ): Promise<Exclude<SpreadsheetRead, { status: 'ok' }> | null> {
    if (response.status === 401) {
      await this.auth.invalidateAccessToken(token);
      return { status: 'unauthenticated' };
    }

    if (response.status === 404) {
      return { status: 'access_denied', notFound: true };
    }

    if (response.status === 403) {
      if (await sheetsApiDisabled(response.clone())) {
        return { status: 'access_denied', cause: 'sheets_api_disabled' };
      }

      return { status: 'access_denied' };
    }

    if (!response.ok) {
      return {
        status: 'unavailable',
        detail: await googleErrorDetail(response),
      };
    }

    return null;
  }

  private async request(
    token: string,
    url: string,
    body?: string,
  ): Promise<
    | { status: 'ok'; response: Response }
    | { status: 'unavailable'; detail: string }
  > {
    const method = body == null ? 'GET' : 'POST';
    logVerify('http.request', { method, url, body: body ?? null });

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body == null ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body == null ? {} : { body }),
      });
      logVerify('http.response', {
        method,
        url,
        status: response.status,
        body: await response.clone().text(),
      });

      return { status: 'ok', response };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logVerify('http.error', { method, url, detail, error });

      return { status: 'unavailable', detail };
    }
  }
}

function quoteColumnRange(title: string, column: string): string {
  return `${quoteSheetTitle(title)}!${column}2:${column}`;
}

function quoteLinkRange(title: string): string {
  return quoteColumnRange(title, 'N');
}

function quoteSheetTitle(title: string): string {
  return `'${title.replaceAll("'", "''")}'`;
}

function applicationRows(
  sheet: string,
  companies: readonly string[][],
  dates: readonly string[][],
  links: readonly string[][],
  statuses: readonly string[][],
  formulas: readonly string[][],
  hyperlinks: readonly string[],
): StoredApplication[] {
  const count = Math.max(
    companies.length,
    dates.length,
    links.length,
    statuses.length,
    formulas.length,
    hyperlinks.length,
  );
  const lastRow = count === 0 ? 1 : count + 1;

  return Array.from({ length: count }, (_, index) => index).flatMap((index) => {
    const url = applicationUrl(
      hyperlinks[index] ?? '',
      formulas[index]?.[0] ?? '',
      links[index]?.[0] ?? '',
    );

    if (url === '') {
      return [];
    }

    return [
      {
        sheet,
        row: index + 2,
        lastRow,
        url,
        appliedOn: dates[index]?.[0]?.trim() ?? '',
        status: statuses[index]?.[0]?.trim() ?? '',
      },
    ];
  });
}

function applicationUrl(
  hyperlink: string,
  formula: string,
  formatted: string,
): string {
  const linked = hyperlink.trim();

  if (linked !== '') {
    return linked;
  }

  const fromFormula = hyperlinkTarget(formula);

  if (fromFormula !== '') {
    return fromFormula;
  }

  const shown = formatted.trim();

  return shown.startsWith('=') ? '' : shown;
}

function hyperlinkTarget(formula: string): string {
  const match = /^=HYPERLINK\(\s*"((?:[^"]|"")*)"/i.exec(formula.trim());

  return match?.[1]?.replaceAll('""', '"') ?? '';
}

function describeToken(
  token:
    | { status: 'ok'; token: string }
    | Exclude<SpreadsheetRead, { status: 'ok' }>,
): unknown {
  if (token.status === 'ok') {
    return { status: 'ok', tokenLength: token.token.length };
  }

  return token;
}

async function googleErrorDetail(response: Response): Promise<string> {
  const status = String(response.status);

  try {
    const body = (await response.json()) as { error?: { message?: string } };
    const message = body.error?.message?.trim() ?? '';

    return message === '' ? status : `${status} ${message}`;
  } catch {
    return status;
  }
}

async function sheetsApiDisabled(response: Response): Promise<boolean> {
  try {
    const body = (await response.json()) as {
      error?: {
        message?: string;
        status?: string;
        errors?: Array<{ reason?: string }>;
      };
    };
    const message = [
      body.error?.message,
      body.error?.status,
      body.error?.errors?.[0]?.reason,
    ]
      .filter((part) => part != null)
      .join(' ');

    return /has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(
      message,
    );
  } catch {
    return false;
  }
}
