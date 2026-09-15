import { describe, it, expect, vi, beforeEach } from 'vitest';
import errorHandler from '../middleware/errorHandler.js';

vi.mock('../config/logging.js', () => ({
  log: vi.fn(),
}));

function makeRes() {
  const res: { statusCode?: number; body?: unknown } = {};
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status(code: any) {
      res.statusCode = code;
      return this;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json(body: any) {
      res.body = body;
      return this;
    },
    get statusCode() {
      return res.statusCode;
    },
    get body() {
      return res.body;
    },
  };
}

describe('errorHandler', () => {
  const originalEnv = process.env.NODE_ENV;
  beforeEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('defaults an unmarked error to 500 and hides its message', () => {
    const res = makeRes();
    errorHandler(new Error('connection refused at 10.0.0.5'), {}, res, vi.fn());
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: string }).error).toBe('Internal Server Error');
  });

  it('honors a service error status (createServiceError) in the 4xx range and keeps its message', () => {
    const res = makeRes();
    const error = Object.assign(new Error('Workout preset not found.'), {
      status: 404,
    });
    errorHandler(error, {}, res, vi.fn());
    expect(res.statusCode).toBe(404);
    expect((res.body as { error: string }).error).toBe(
      'Workout preset not found.'
    );
  });

  it('honors a library-set statusCode distinct from status', () => {
    const res = makeRes();
    const error = Object.assign(new Error('Payload too large'), {
      statusCode: 413,
    });
    errorHandler(error, {}, res, vi.fn());
    expect(res.statusCode).toBe(413);
    expect((res.body as { error: string }).error).toBe('Payload too large');
  });

  it('falls back to 500 when the declared status is out of the valid http range', () => {
    const res = makeRes();
    const error = Object.assign(new Error('bogus status'), { status: 999 });
    errorHandler(error, {}, res, vi.fn());
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: string }).error).toBe('Internal Server Error');
  });

  it('still hides the message for a declared 5xx status', () => {
    const res = makeRes();
    const error = Object.assign(new Error('upstream provider timed out'), {
      status: 502,
    });
    errorHandler(error, {}, res, vi.fn());
    expect(res.statusCode).toBe(502);
    expect((res.body as { error: string }).error).toBe('Internal Server Error');
  });

  it('maps a unique-constraint violation to 409', () => {
    const res = makeRes();
    const error = Object.assign(new Error('duplicate key value'), {
      code: '23505',
    });
    errorHandler(error, {}, res, vi.fn());
    expect(res.statusCode).toBe(409);
    expect((res.body as { error: string }).error).toBe(
      'Conflict: A resource with this unique identifier already exists.'
    );
  });

  it('includes the stack only in development', () => {
    process.env.NODE_ENV = 'development';
    const res = makeRes();
    const error = Object.assign(new Error('Workout preset not found.'), {
      status: 404,
    });
    errorHandler(error, {}, res, vi.fn());
    expect((res.body as { details?: string }).details).toBeDefined();

    process.env.NODE_ENV = 'production';
    const res2 = makeRes();
    errorHandler(error, {}, res2, vi.fn());
    expect((res2.body as { details?: string }).details).toBeUndefined();
  });
});
