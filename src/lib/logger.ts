/**
 * Google-Grade Structured Logger
 * In a real Google app, this would route to a telemetry service.
 * Here, we wrap console methods but prepare for integrations like Sentry or Datadog.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const payload = { timestamp, level, message, ...meta };

    switch (level) {
      case 'info':
        console.info(JSON.stringify(payload));
        break;
      case 'warn':
        console.warn(JSON.stringify(payload));
        break;
      case 'error':
        // Here you would send the error to Sentry/Datadog
        console.error(JSON.stringify(payload));
        break;
      case 'debug':
        if (process.env.NODE_ENV !== 'production') {
          console.debug(JSON.stringify(payload));
        }
        break;
    }
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>) {
    this.log('error', message, { error, ...meta } as Record<string, unknown>);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log('debug', message, meta);
  }
}

export const logger = new Logger();
