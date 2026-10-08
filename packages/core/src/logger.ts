export type LogLevel = "debug" | "info" | "warn" | "error" | "silent"

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
}

export interface Logger {
  level: LogLevel
  debug(message: string, extra?: unknown): void
  info(message: string, extra?: unknown): void
  warn(message: string, extra?: unknown): void
  error(message: string, extra?: unknown): void
}

export class ConsoleLogger implements Logger {
  constructor(public level: LogLevel = "warn") {}

  debug(message: string, extra?: unknown): void {
    this.write("debug", message, extra)
  }

  info(message: string, extra?: unknown): void {
    this.write("info", message, extra)
  }

  warn(message: string, extra?: unknown): void {
    this.write("warn", message, extra)
  }

  error(message: string, extra?: unknown): void {
    this.write("error", message, extra)
  }

  private write(level: LogLevel, message: string, extra?: unknown): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.level]) return
    const prefix = `[Arc3DLab:${level}] ${message}`
    if (level === "error") {
      extra === undefined ? console.error(prefix) : console.error(prefix, extra)
      return
    }
    if (level === "warn") {
      extra === undefined ? console.warn(prefix) : console.warn(prefix, extra)
      return
    }
    extra === undefined ? console.log(prefix) : console.log(prefix, extra)
  }
}
