import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('emits JSON lines to stdout for info', async () => {
    vi.stubEnv('LOG_LEVEL', 'info');
    const { logger } = await import('./logger');
    logger.info({ route: '/api/foo', userId: 42 }, 'hello');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(line.level).toBe('info');
    expect(line.route).toBe('/api/foo');
    expect(line.userId).toBe(42);
    expect(line.msg).toBe('hello');
    expect(typeof line.time).toBe('string');
  });

  it('emits errors to stderr', async () => {
    vi.stubEnv('LOG_LEVEL', 'info');
    const { logger } = await import('./logger');
    logger.error({ route: '/api/foo' }, 'boom');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    const line = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(line.level).toBe('error');
  });

  it('serializes Error instances into name/message, drops stack in prod', async () => {
    vi.stubEnv('LOG_LEVEL', 'info');
    vi.stubEnv('NODE_ENV', 'production');
    const { logger } = await import('./logger');
    logger.error({ err: new Error('db dead'), route: '/x' });

    const line = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(line.errName).toBe('Error');
    expect(line.errMessage).toBe('db dead');
    expect(line.errStack).toBeUndefined();
  });

  it('includes stack in non-prod', async () => {
    vi.stubEnv('LOG_LEVEL', 'info');
    vi.stubEnv('NODE_ENV', 'development');
    const { logger } = await import('./logger');
    logger.error({ err: new Error('db dead') });

    const line = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(typeof line.errStack).toBe('string');
  });

  it('honors LOG_LEVEL filtering', async () => {
    vi.stubEnv('LOG_LEVEL', 'warn');
    const { logger } = await import('./logger');
    logger.info({ route: '/x' });
    logger.debug({ route: '/x' });
    logger.warn({ route: '/x' });

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('accepts a bare string message', async () => {
    vi.stubEnv('LOG_LEVEL', 'info');
    const { logger } = await import('./logger');
    logger.info('just a string');

    const line = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(line.msg).toBe('just a string');
  });
});
