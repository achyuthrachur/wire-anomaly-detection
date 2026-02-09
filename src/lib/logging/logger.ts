import pino from 'pino';

const isServer = typeof window === 'undefined';

/**
 * Structured logger.
 *
 * - On the server: full pino logger (with pino-pretty in dev).
 * - On the client: thin console wrapper so imports don't explode in the
 *   browser bundle.
 */
export const logger: pino.Logger = isServer
  ? pino({
      level: process.env.APP_ENV === 'prod' ? 'info' : 'debug',
      transport:
        process.env.APP_ENV !== 'prod'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    })
  : ({
      // Minimal client-side fallback (noop in production)
      info: (...args: unknown[]) => console.log(...args),
      warn: (...args: unknown[]) => console.warn(...args),
      error: (...args: unknown[]) => console.error(...args),
      debug: (...args: unknown[]) => console.debug(...args),
      child: () => logger,
    } as unknown as pino.Logger);

/**
 * Create a child logger scoped to a specific domain (e.g. "upload", "validate").
 */
export function createChildLogger(domain: string): pino.Logger {
  if (isServer) {
    return logger.child({ domain });
  }
  return logger;
}
