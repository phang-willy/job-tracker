import { describe, expect, it, vi } from 'vitest';
import type { ApplicationDraft } from '@/src/domain/spreadsheet/application-draft';
import { sheetSerialFromCivilDate } from '@/src/domain/spreadsheet/sheet-date';
import type { GoogleAuthGateway } from '@/src/infrastructure/google/chrome-google-auth';
import { GoogleSheetsGateway } from '@/src/infrastructure/google/google-sheets-gateway';

const auth: GoogleAuthGateway = {
  getAccessToken: () => Promise.resolve('token'),
  invalidateAccessToken: () => Promise.resolve(),
};

const draft: ApplicationDraft = {
  company: 'Quik Hire',
  country: 'France',
  region: '',
  city: '',
  title: 'Frontend Web Developer',
  monthlySalary: '4000',
  annualSalary: '48000',
  appliedOn: '2026-02-01',
  contractType: 'CDI',
  url: 'https://www.linkedin.com/jobs/view/4467438805/',
};

describe('GoogleSheetsGateway insertApplication', () => {
  it('opens a row between two dates and keeps the annual formula', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);

      if (url.includes('sheets.properties')) {
        return json({
          sheets: [{ properties: { title: '2026', sheetId: 42 } }],
        });
      }

      if (url.includes('UNFORMATTED_VALUE')) {
        return json({
          valueRanges: [
            {
              values: [
                [sheetSerialFromCivilDate('2026-01-01')],
                [sheetSerialFromCivilDate('2026-03-01')],
              ],
            },
          ],
        });
      }

      if (url.includes('FORMULA')) {
        return json({
          valueRanges: [{ values: [['=F2*12'], ['=F3*12']] }],
        });
      }

      if (init?.body != null) {
        return json({});
      }

      return json({});
    });
    const gateway = new GoogleSheetsGateway(auth, fetchImpl);

    await expect(gateway.insertApplication('sheet-id', draft)).resolves.toEqual(
      { status: 'inserted' },
    );

    const post = fetchImpl.mock.calls.find((call) =>
      String(call[0]).includes('batchUpdate'),
    );
    const body = JSON.parse(String(post?.[1]?.body)) as {
      requests: Array<
        Record<
          string,
          {
            range?: {
              startColumnIndex?: number;
              startIndex?: number;
              sheetId?: number;
            };
            pasteType?: string;
          }
        >
      >;
    };
    const names = body.requests.map((request) => Object.keys(request)[0]);

    expect(names).toContain('insertDimension');
    expect(body.requests[0]?.insertDimension?.range).toMatchObject({
      sheetId: 42,
      startIndex: 2,
    });
    expect(
      body.requests.some(
        (request) => request.copyPaste?.pasteType === 'PASTE_FORMULA',
      ),
    ).toBe(true);
    expect(
      body.requests.some(
        (request) => request.updateCells?.range?.startColumnIndex === 6,
      ),
    ).toBe(false);
    expect(JSON.stringify(body)).toContain(
      String(sheetSerialFromCivilDate('2026-02-01')),
    );
    expect(JSON.stringify(body)).toContain(draft.url);
  });

  it('does not send a batch when column H is not ordered', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes('sheets.properties')) {
        return json({
          sheets: [{ properties: { title: '2026', sheetId: 42 } }],
        });
      }

      return json({
        valueRanges: [
          {
            values: [
              [sheetSerialFromCivilDate('2026-03-01')],
              [sheetSerialFromCivilDate('2026-01-01')],
            ],
          },
        ],
      });
    });
    const gateway = new GoogleSheetsGateway(auth, fetchImpl);

    await expect(gateway.insertApplication('sheet-id', draft)).resolves.toEqual(
      { status: 'unsorted' },
    );
    expect(
      fetchImpl.mock.calls.some((call) =>
        String(call[0]).includes('batchUpdate'),
      ),
    ).toBe(false);
  });

  it('does not write when Drive reports the spreadsheet as read-only', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      expect(init?.method ?? 'GET').toBe('GET');
      expect(String(input)).toContain('/drive/v3/files/');

      return json({ capabilities: { canEdit: false } });
    });
    const gateway = new GoogleSheetsGateway(auth, fetchImpl);

    await expect(gateway.insertApplication('sheet-id', draft)).resolves.toEqual(
      { status: 'denied' },
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}
