const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

function timestamp(): string {
  return new Date().toISOString();
}

// Redact common sensitive patterns from log messages
function redact(msg: unknown): string {
  const s = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2);
  return s
    .replace(/("password"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
    .replace(/("token"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
    .replace(/("secret"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
    .replace(/("api_key"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]');
}

export const logger = {
  info: (...args: unknown[]) => {
    console.log(`[${timestamp()}] INFO:`, ...args.map(redact));
  },
  warn: (...args: unknown[]) => {
    console.warn(`[${timestamp()}] WARN:`, ...args.map(redact));
  },
  error: (...args: unknown[]) => {
    console.error(`[${timestamp()}] ERROR:`, ...args.map(redact));
  },
  debug: (...args: unknown[]) => {
    if (LOG_LEVEL === 'debug') {
      console.debug(`[${timestamp()}] DEBUG:`, ...args.map(redact));
    }
  },
};
