/** 日志级别，级别越高输出的信息越少。 */
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent"

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
}

/** 日志记录器接口，定义各日志级别的输出方法。 */
export interface Logger {
  /** 当前日志级别。 */
  level: LogLevel
  /** 输出调试日志。 */
  debug(message: string, extra?: unknown): void
  /** 输出信息日志。 */
  info(message: string, extra?: unknown): void
  /** 输出警告日志。 */
  warn(message: string, extra?: unknown): void
  /** 输出错误日志。 */
  error(message: string, extra?: unknown): void
}

/** 基于控制台 API 输出日志的日志记录器实现。 */
export class ConsoleLogger implements Logger {
  /**
   * 创建控制台日志记录器。
   *
   * @param level - 日志级别，默认为 `"warn"`。
   */
  constructor(public level: LogLevel = "warn") {}

  /**
   * 输出调试日志。
   *
   * @param message - 日志信息。
   * @param extra - 附加数据。
   */
  debug(message: string, extra?: unknown): void {
    this.write("debug", message, extra)
  }

  /**
   * 输出信息日志。
   *
   * @param message - 日志信息。
   * @param extra - 附加数据。
   */
  info(message: string, extra?: unknown): void {
    this.write("info", message, extra)
  }

  /**
   * 输出警告日志。
   *
   * @param message - 日志信息。
   * @param extra - 附加数据。
   */
  warn(message: string, extra?: unknown): void {
    this.write("warn", message, extra)
  }

  /**
   * 输出错误日志。
   *
   * @param message - 日志信息。
   * @param extra - 附加数据。
   */
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
