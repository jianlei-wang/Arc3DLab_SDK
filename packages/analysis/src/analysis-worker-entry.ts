import { executeAnalysisJob } from "./jobs"
import {
  serializeAnalysisError,
  type AnalysisWorkerRequest,
  type AnalysisWorkerResponse,
} from "./worker-protocol"

/** 工作线程全局作用域的最小形状。 */
interface WorkerScope {
  /** 工作线程消息处理器。 */
  onmessage: ((event: { data: unknown }) => void) | null
  /** 向主线程回传消息。 */
  postMessage(message: AnalysisWorkerResponse): void
}

const scope = self as unknown as WorkerScope

scope.onmessage = (event) => {
  const { id, job } = event.data as AnalysisWorkerRequest
  try {
    scope.postMessage({ id, result: executeAnalysisJob(job) })
  } catch (error) {
    scope.postMessage({ id, error: serializeAnalysisError(error) })
  }
}
