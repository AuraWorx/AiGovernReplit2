/**
 * Simple logger utility.
 * Consider replacing with a more robust logger like Winston or Pino in production
 * for structured logging, log levels, and transports.
 */
export function log(message: string, source = "server") {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} [${source}] ${message}`);
  }
  