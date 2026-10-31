import { z } from 'zod';

// Extension pages forbid eval. Without this, Zod probes `new Function` and the CSP reports it.
z.config({ jitless: true });

export { z };
