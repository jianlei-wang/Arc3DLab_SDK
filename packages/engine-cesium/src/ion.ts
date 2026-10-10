import * as Cesium from "cesium"

/**
 * 描述以作用域方式临时设置 Cesium Ion 令牌的能力。
 */
export interface IonTokenScope {
  /**
   * 在指定令牌下执行一段异步任务。
   * @param token - 临时使用的 Ion 令牌。
   * @param work - 在令牌生效期间执行的任务。
   * @returns 任务执行结果的 Promise。
   */
  run<T>(token: string | undefined, work: () => Promise<T>): Promise<T>
}

/**
 * 串行化的 Ion 令牌作用域实现，保证令牌设置与恢复按顺序执行。
 */
export class SerialIonTokenScope implements IonTokenScope {
  private chain: Promise<unknown> = Promise.resolve()

  /**
   * 在指定令牌下串行执行一段异步任务。
   * @param token - 临时使用的 Ion 令牌。
   * @param work - 在令牌生效期间执行的任务。
   * @returns 任务执行结果的 Promise。
   */
  run<T>(token: string | undefined, work: () => Promise<T>): Promise<T> {
    if (!token) return Promise.resolve().then(work)
    const next = this.chain.then(async () => {
      const previous = Cesium.Ion.defaultAccessToken
      Cesium.Ion.defaultAccessToken = token
      try {
        return await work()
      } finally {
        Cesium.Ion.defaultAccessToken = previous
      }
    })
    this.chain = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
}

/**
 * 全局共享的串行 Ion 令牌作用域实例。
 */
export const sharedIonTokenScope = new SerialIonTokenScope()

/**
 * 在指定 Ion 令牌的作用域内执行一段异步任务。
 * @param token - 临时使用的 Ion 令牌。
 * @param work - 在令牌生效期间执行的任务。
 * @param scope - 使用的令牌作用域，默认使用共享作用域。
 * @returns 任务执行结果的 Promise。
 */
export function withIonAccessToken<T>(
  token: string | undefined,
  work: () => Promise<T>,
  scope: IonTokenScope = sharedIonTokenScope,
): Promise<T> {
  return scope.run(token, work)
}

/**
 * 从配置中读取 Cesium Ion 令牌。
 * @param config - 包含引擎与令牌配置的对象。
 * @returns 配置中的 Ion 令牌，未配置时返回 undefined。
 */
export function readIonToken(config: {
  engine?: { cesium?: { ionToken?: string } }
  tokens?: { cesiumIon?: string }
}): string | undefined {
  return config.engine?.cesium?.ionToken ?? config.tokens?.cesiumIon
}
