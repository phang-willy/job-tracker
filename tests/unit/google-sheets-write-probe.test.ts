import { describe, expect, it, vi } from 'vitest';
import type { GoogleAuthGateway } from '@/src/infrastructure/google/chrome-google-auth';
import { GoogleSheetsGateway } from '@/src/infrastructure/google/google-sheets-gateway';

const auth: GoogleAuthGateway = {
  getAccessToken: () => Promise.resolve('token'),
  invalidateAccessToken: () => Promise.resolve(),
};

describe('GoogleSheetsGateway probeWriteAccess', () => {
  it('confirms write access from Drive capabilities without mutating the spreadsheet', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      expect(init?.method ?? 'GET').toBe('GET');
      expect(String(input)).toContain(
        'https://www.googleapis.com/drive/v3/files/sheet-id',
      );
      expect(String(input)).toContain('capabilities');
      expect(String(input)).not.toContain('batchUpdate');

      return json({ capabilities: { canEdit: true } });
    });
    const gateway = new GoogleSheetsGateway(auth, fetchImpl);

    await expect(gateway.probeWriteAccess('sheet-id')).resolves.toEqual({
      status: 'ok',
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('reports read-only access when Drive says the file cannot be edited', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ capabilities: { canEdit: false } }));
    const gateway = new GoogleSheetsGateway(auth, fetchImpl);

    await expect(gateway.probeWriteAccess('sheet-id')).resolves.toEqual({
      status: 'denied',
    });
    expect(String(fetchImpl.mock.calls[0]?.[1]?.method ?? 'GET')).toBe('GET');
  });

  it('leaves write access unverified when Drive cannot answer', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 403 }));
    const gateway = new GoogleSheetsGateway(auth, fetchImpl);

    await expect(gateway.probeWriteAccess('sheet-id')).resolves.toEqual({
      status: 'unverified',
    });
  });

  it('reports an expired token before calling Google', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const gateway = new GoogleSheetsGateway(
      {
        getAccessToken: () => Promise.reject(new Error('expired')),
        invalidateAccessToken: () => Promise.resolve(),
      },
      fetchImpl,
    );

    await expect(gateway.probeWriteAccess('sheet-id')).resolves.toEqual({
      status: 'unauthenticated',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('GoogleSheetsGateway readStructure errors', () => {
  it('asks for a new Google connection after a 401', async () => {
    const invalidateAccessToken = vi.fn(() => Promise.resolve());
    const gateway = new GoogleSheetsGateway(
      {
        getAccessToken: () => Promise.resolve('token'),
        invalidateAccessToken,
      },
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status: 401 })),
    );

    await expect(gateway.readStructure('sheet-id')).resolves.toEqual({
      status: 'unauthenticated',
    });
    expect(invalidateAccessToken).toHaveBeenCalledWith('token');
  });

  it('reports a refused spreadsheet after a 403', async () => {
    const gateway = new GoogleSheetsGateway(
      auth,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status: 403 })),
    );

    await expect(gateway.readStructure('sheet-id')).resolves.toEqual({
      status: 'access_denied',
    });
  });

  it('reports a missing spreadsheet after a 404', async () => {
    const gateway = new GoogleSheetsGateway(
      auth,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status: 404 })),
    );

    await expect(gateway.readStructure('sheet-id')).resolves.toEqual({
      status: 'access_denied',
      notFound: true,
    });
  });

  it('reports a network error without calling a mutation', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      expect(init?.method ?? 'GET').toBe('GET');
      expect(String(input)).not.toContain('batchUpdate');
      throw new Error('Failed to fetch');
    });
    const gateway = new GoogleSheetsGateway(auth, fetchImpl);

    await expect(gateway.readStructure('sheet-id')).resolves.toEqual({
      status: 'unavailable',
      detail: 'Failed to fetch',
    });
  });
});

describe('GoogleSheetsGateway readStructure', () => {
  it('reads the current year and an existing neighbor, not every annual tab', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            properties: { title: 'Suivi' },
            sheets: [
              { properties: { title: '1990' } },
              { properties: { title: '2025' } },
              { properties: { title: '2026' } },
              { properties: { title: '2099' } },
              { properties: { title: 'Paramètres' } },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sheets: [] }), { status: 200 }),
      );
    const gateway = new GoogleSheetsGateway(
      auth,
      fetchImpl,
      () => new Date(2026, 9, 14),
    );

    await gateway.readStructure('sheet-id');

    const secondUrl = String(fetchImpl.mock.calls[1]?.[0]);
    expect(secondUrl).toContain('2025');
    expect(secondUrl).toContain('2026');
    expect(secondUrl).not.toContain('1990');
    expect(secondUrl).not.toContain('2027');
    expect(secondUrl).not.toContain('2099');
  });
});

describe('GoogleSheetsGateway listApplications', () => {
  it('reads the values API and keeps a hyperlink on the last row', async () => {
    const gateway = new GoogleSheetsGateway(auth, async (input) => {
      const url = String(input);

      if (url.includes('sheets.properties.title')) {
        return json({
          sheets: [
            { properties: { title: '2026' } },
            { properties: { title: 'Notes' } },
          ],
        });
      }

      if (url.includes('values:batchGet') && url.includes('FORMULA')) {
        return json({
          valueRanges: [
            {
              values: [
                ['label'],
                [
                  '=HYPERLINK("https://www.linkedin.com/jobs/view/4430481397/","offre")',
                ],
              ],
            },
          ],
        });
      }

      if (url.includes('values:batchGet')) {
        expect(url).toContain('N2%3AN');
        expect(url).toContain('A2');

        return json({
          valueRanges: [
            { values: [['linq'], ['linq'], [''], ['derniere']] },
            { values: [['2026-06-01'], ['2026-06-12']] },
            { values: [[''], ['offre']] },
            { values: [['Refus'], ['Entretien']] },
          ],
        });
      }

      return json({
        sheets: [
          {
            properties: { title: '2026' },
            data: [
              {
                rowData: [
                  { values: [{}] },
                  {
                    values: [
                      {
                        hyperlink:
                          'https://www.linkedin.com/jobs/view/4430481397/',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    await expect(gateway.listApplications('sheet-id')).resolves.toEqual({
      status: 'ok',
      rows: [
        {
          sheet: '2026',
          row: 3,
          lastRow: 5,
          url: 'https://www.linkedin.com/jobs/view/4430481397/',
          appliedOn: '2026-06-12',
          status: 'Entretien',
        },
      ],
    });
  });

  it('keeps formatted urls when the hyperlink grid is refused', async () => {
    const gateway = new GoogleSheetsGateway(auth, async (input) => {
      const url = String(input);

      if (url.includes('sheets.properties.title')) {
        return json({ sheets: [{ properties: { title: '2026' } }] });
      }

      if (url.includes('values:batchGet') && url.includes('FORMULA')) {
        return new Response('{}', { status: 400 });
      }

      if (url.includes('values:batchGet')) {
        return json({
          valueRanges: [
            { values: [['linq']] },
            { values: [['2026-06-12']] },
            {
              values: [
                ['https://www.linkedin.com/jobs/view/4430481397/?trk=old'],
              ],
            },
            { values: [['Entretien']] },
          ],
        });
      }

      return new Response('{}', { status: 400 });
    });

    await expect(gateway.listApplications('sheet-id')).resolves.toEqual({
      status: 'ok',
      rows: [
        {
          sheet: '2026',
          row: 2,
          lastRow: 2,
          url: 'https://www.linkedin.com/jobs/view/4430481397/?trk=old',
          appliedOn: '2026-06-12',
          status: 'Entretien',
        },
      ],
    });
  });

  it('renews the token when Google rejects the first read', async () => {
    let formattedReads = 0;
    const getAccessToken = vi.fn(() => Promise.resolve('token'));
    const gateway = new GoogleSheetsGateway(
      {
        getAccessToken,
        invalidateAccessToken: () => Promise.resolve(),
      },
      async (input) => {
        const url = String(input);

        if (url.includes('sheets.properties.title')) {
          return json({ sheets: [{ properties: { title: '2026' } }] });
        }

        if (url.includes('values:batchGet') && url.includes('FORMULA')) {
          return new Response('{}', { status: 400 });
        }

        if (url.includes('values:batchGet')) {
          formattedReads += 1;

          if (formattedReads === 1) {
            return new Response('{}', { status: 401 });
          }

          return json({
            valueRanges: [
              { values: [['linq']] },
              { values: [['2026-06-12']] },
              {
                values: [['https://www.linkedin.com/jobs/view/4430481397/']],
              },
              { values: [['Envoyée']] },
            ],
          });
        }

        return new Response('{}', { status: 400 });
      },
    );

    await expect(gateway.listApplications('sheet-id')).resolves.toEqual({
      status: 'ok',
      rows: [
        {
          sheet: '2026',
          row: 2,
          lastRow: 2,
          url: 'https://www.linkedin.com/jobs/view/4430481397/',
          appliedOn: '2026-06-12',
          status: 'Envoyée',
        },
      ],
    });
    expect(getAccessToken).toHaveBeenCalledTimes(2);
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}
