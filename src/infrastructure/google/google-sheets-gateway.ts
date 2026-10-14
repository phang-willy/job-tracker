import type {
  SpreadsheetRead,
  WriteProbe,
} from '@/src/application/ports/spreadsheet';
import { titlesToVerify } from '@/src/domain/spreadsheet/structure';
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

  async probeWriteAccess(spreadsheetId: string): Promise<WriteProbe> {
    const token = await this.accessToken();

    logVerify('auth', describeToken(token));

    if (token.status !== 'ok') {
      return token;
    }

    const sent = await this.request(
      token.token,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      JSON.stringify(writeProbeBody()),
    );

    if (sent.status !== 'ok') {
      return sent;
    }

    const response = sent.response;

    if (
      response.status === 403 &&
      !(await sheetsApiDisabled(response.clone()))
    ) {
      return { status: 'denied' };
    }

    const failure = await this.failureStatus(response, token.token);

    return failure ?? { status: 'ok' };
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

  private async failureStatus(
    response: Response,
    token: string,
  ): Promise<Exclude<SpreadsheetRead, { status: 'ok' }> | null> {
    if (response.status === 401) {
      await this.auth.invalidateAccessToken(token);
      return { status: 'unauthenticated' };
    }

    if (response.status === 403 || response.status === 404) {
      if (
        response.status === 403 &&
        (await sheetsApiDisabled(response.clone()))
      ) {
        return { status: 'access_denied', cause: 'sheets_api_disabled' };
      }

      return { status: 'access_denied' };
    }

    if (!response.ok) {
      return { status: 'unavailable', detail: String(response.status) };
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

function writeProbeBody(): { requests: object[] } {
  const metadataKey = 'jobTrackerWriteProbe';

  const removeProbe = {
    deleteDeveloperMetadata: {
      dataFilter: {
        developerMetadataLookup: {
          metadataKey,
          visibility: 'DOCUMENT',
        },
      },
    },
  };

  return {
    requests: [
      removeProbe,
      {
        createDeveloperMetadata: {
          developerMetadata: {
            metadataKey,
            metadataValue: 'probe',
            visibility: 'DOCUMENT',
            location: { spreadsheet: true },
          },
        },
      },
      removeProbe,
    ],
  };
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
