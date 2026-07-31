export type LogFields = Record<string, string | number | boolean | undefined>;

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

export function createLogger(
  write: (line: string) => void = console.log,
  now: () => Date = () => new Date()
): Logger {
  function log(level: 'info' | 'warn' | 'error', event: string, fields: LogFields = {}): void {
    const definedFields = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined)
    );
    write(JSON.stringify({
      ...definedFields,
      timestamp: now().toISOString(),
      level,
      event,
    }));
  }

  return {
    info: (event, fields) => log('info', event, fields),
    warn: (event, fields) => log('warn', event, fields),
    error: (event, fields) => log('error', event, fields),
  };
}
