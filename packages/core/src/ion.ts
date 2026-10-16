import type { Arc3DContext } from "./context"
import type { RunWithIonToken } from "./types"

/**
 * 在实例级 Ion 令牌合同下执行一段异步工作。
 *
 * 该函数是 `EngineContext.runWithIonToken` 的容错封装：当引擎实现了该能力时，
 * 工作会在实例令牌（或被 `token` 覆盖）作用域内执行，并保证并发调用串行设置
 * 与恢复全局令牌；当引擎未实现该能力（或在无引擎的测试环境中）时，直接执行
 * 工作。业务模块无需判断底层是否提供令牌作用域。
 *
 * @param context - Arc3D 运行时上下文。
 * @param work - 需要执行的异步工作。
 * @param token - 覆盖令牌；省略时使用实例令牌。
 * @returns 工作的执行结果。
 */
export function runWithIonToken<T>(
  context: Pick<Arc3DContext, "engine">,
  work: () => Promise<T>,
  token?: string,
): Promise<T> {
  const run: RunWithIonToken | undefined = context.engine?.runWithIonToken
  if (run) {
    return run(work, token)
  }
  return work()
}
