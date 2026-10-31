import { afterEach, describe, expect, it } from 'vitest';
import { z } from '@/src/infrastructure/zod';

describe('zod CSP mode', () => {
  const RealFunction = globalThis.Function;

  afterEach(() => {
    globalThis.Function = RealFunction;
  });

  it('builds and parses an object schema without evaluating a string', () => {
    let evaluated = false;
    globalThis.Function = new Proxy(RealFunction, {
      apply(target, thisArg, args) {
        evaluated = true;
        return Reflect.apply(target, thisArg, args);
      },
      construct(target, args, newTarget) {
        evaluated = true;
        return Reflect.construct(target, args, newTarget);
      },
    });

    const schema = z.object({ name: z.string() });

    expect(schema.parse({ name: 'Ada' })).toEqual({ name: 'Ada' });
    expect(evaluated).toBe(false);
  });
});
