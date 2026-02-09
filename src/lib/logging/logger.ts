import pino from 'pino';

const isServer = typeof window === 'undefined';

export const logger: pino.Logger = isServer
  ? pino({
      level: process.env.APP_ENV === 'prod' ? 'info' : 'debug',
      // Avoid pino-pretty transport in serverless — it spawns worker threads
      // that don't work reliably in Vercel's serverless environment.
    })
  : ({
      info: (...args: unknown[]) => console.log(...args),
      warn: (...args: unknown[]) => console.warn(...args),
      error: (...args: unknown[]) => console.error(...args),
      debug: (...args: unknown[]) => console.debug(...args),
      child: () => logger,
    } as unknown as pino.Logger);

export function createChildLogger(domain: string): pino.Logger {
  if (isServer) {
    return logger.child({ domain });
  }
  return logger;
}
