import { describe, expect, it, vi } from 'vitest';
import type { GoogleAuthGateway } from '@/src/infrastructure/google/chrome-google-auth';
import { GoogleSheetsGateway } from '@/src/infrastructure/google/google-sheets-gateway';

const auth: GoogleAuthGateway = {
  getAccessToken: () => Promise.resolve('token'),
  invalidateAccessToken: () => Promise.resolve(),
};

describe('GoogleSheetsGateway probeWriteAccess', () => {
  it('asks Google to create and remove a write mark in one request', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    const gateway = new GoogleSheetsGateway(auth, fetchImpl);

    await expect(gateway.probeWriteAccess('sheet-id')).resolves.toEqual({
      status: 'ok',
    });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      requests: Array<Record<string, unknown>>;
    };

    expect(body.requests).toHaveLength(3);
    expect(body.requests[0]).toHaveProperty('deleteDeveloperMetadata');
    expect(body.requests[1]).toHaveProperty('createDeveloperMetadata');
    expect(body.requests[2]).toHaveProperty('deleteDeveloperMetadata');
    expect(JSON.stringify(body)).not.toContain('addSheet');
    expect(JSON.stringify(body)).not.toContain('"rows"');
  });

  it('reports a refused write when Google returns 403', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 403 }));
    const gateway = new GoogleSheetsGateway(auth, fetchImpl);

    await expect(gateway.probeWriteAccess('sheet-id')).resolves.toEqual({
      status: 'denied',
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
