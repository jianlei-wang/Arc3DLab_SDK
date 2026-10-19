import { Arc3DError } from "@arc3dlab/core"
import {
  executeAnalysisJobCooperatively,
  type AnalysisJob,
  type AnalysisJobResult,
} from "./jobs"
import { yieldToEventLoop, type AnalysisTaskOptions } from "./scheduler"
import {
  isAnalysisJobResult,
  parseAnalysisWorkerResponse,
  restoreAnalysisError,
  serializeAnalysisError,
  type AnalysisWorkerFactory,
  type AnalysisWorkerLike,
} from "./worker-protocol"

export {
  serializeAnalysisError,
  restoreAnalysisError,
  type SerializedAnalysisError,
  type AnalysisWorkerLike,
  type AnalysisWorkerFactory,
} from "./worker-protocol"

/** 默认的同时执行分析作业的最大 Worker 数量。 */
const DEFAULT_MAX_WORKERS = 4

/** 默认的最大排队作业数量。 */
const DEFAULT_MAX_QUEUE = 128

/** 默认的空闲 Worker 回收时间；0 表示不回收。 */
const DEFAULT_IDLE_TIMEOUT_MS = 30_000

/** `setTimeout` 可可靠表达的最大延迟，避免更长数值被环境截断。 */
const MAX_IDLE_TIMEOUT_MS = 2_147_483_647

/** 一个可复用的 Worker 槽位，同一时刻最多承载一个作业。 */
interface WorkerSlot {
  /** 底层 Worker 实例。 */
  worker: AnalysisWorkerLike
  /** 当前正在执行的作业标识；空闲时为空。 */
  jobId?: number
  /** 空闲回收定时器；执行中或禁用回收时为空。 */
  idleTimer?: ReturnType<typeof setTimeout>
}

/** 未完成的作业条目。 */
interface PendingEntry {
  /** 待执行的作业。 */
  job: AnalysisJob
  /** 本次调用的任务选项。 */
  options?: AnalysisTaskOptions
  /** 作业占用的 Worker 槽位；进程内执行或排队时为空。 */
  slot?: WorkerSlot
  /** 首次开始执行的时间戳；排队中或从未开始时为空。 */
  startedAt?: number
  /** 以结果兑现 Promise。 */
  resolve: (result: AnalysisJobResult) => void
  /** 以错误拒绝 Promise。 */
  reject: (error: Arc3DError) => void
  /** 移除该条目的取消监听等副作用。 */
  cleanup: () => void
}

/** 分析作业宿主的运行诊断快照。 */
export interface AnalysisJobHostDiagnostics {
  /** 允许的最大 Worker 数量。 */
  maxWorkers: number
  /** 允许的最大排队作业数量；`Infinity` 表示不限制。 */
  maxQueue: number
  /** 当前已创建的 Worker 槽位数量。 */
  activeWorkers: number
  /** 当前空闲的 Worker 槽位数量。 */
  idleWorkers: number
  /** 已创建的 Worker 累计数量，用于评估池容量与回收效果。 */
  createdWorkers: number
  /** 因空闲超时被回收的 Worker 累计数量。 */
  reclaimedWorkers: number
  /** 历史同时存在的 Worker 峰值数量，用于评估多实例内存压力。 */
  peakWorkers: number
  /** 空闲回收时间，单位为毫秒；0 表示禁用回收。 */
  idleTimeoutMs: number
  /** 当前正在 Worker 中执行的作业数量。 */
  runningJobs: number
  /** 当前排队等待 Worker 的作业数量。 */
  queuedJobs: number
  /** 已调度但尚未完成的进程内降级作业数量。 */
  inProcessJobs: number
  /**
   * 主线程降级路径的取消模式。
   *
   * `cooperative` 表示可分块作业在块间响应取消；无法分块的作业仍只能在
   * 同步执行完成后观察取消。`completion-only` 表示自定义同步执行器只能在
   * 完成后观察取消。两者都无法像终止 Worker 那样即时中断。
   */
  inProcessCancellation: "cooperative" | "completion-only"
  /** 当前未完成的作业总数，包含运行中、排队与进程内降级作业。 */
  pendingJobs: number
  /** 已开始执行的作业次数，包含 Worker 故障后的进程内重放。 */
  startedJobs: number
  /** 已成功完成的作业数量。 */
  completedJobs: number
  /** 已取消的作业数量。 */
  cancelledJobs: number
  /** 以错误结束的作业数量，包含队列已满与 Worker 故障。 */
  failedJobs: number
  /** 因队列已满被拒绝的作业数量。 */
  rejectedJobs: number
  /** 收到的畸形 Worker 响应数量，用于诊断协议不兼容。 */
  protocolErrors: number
  /** 已纳入耗时统计的作业数量，包含成功、失败与已开始的取消。 */
  timedJobs: number
  /** 已执行作业的累计耗时，单位为毫秒。 */
  totalExecutionMs: number
  /** 已执行作业的平均耗时，单位为毫秒；无样本时为 0。 */
  averageExecutionMs: number
  /** 单次执行的最大耗时，单位为毫秒；无样本时为 0。 */
  maxExecutionMs: number
  /** 最近一次执行的耗时，单位为毫秒；无样本时为 0。 */
  lastExecutionMs: number
  /** Worker 是否已被缓存为不可用。 */
  workerUnavailable: boolean
  /** 宿主是否已终止。 */
  terminated: boolean
}

/**
 * 进程内协作式执行器。
 *
 * 与同步执行器的区别是它可以返回 Promise，并在 `yieldToEventLoop` 之后
 * 检查取消信号，从而让分块作业在主线程也能响应取消。
 */
export type CooperativeAnalysisExecutor = (
  job: AnalysisJob,
  options: {
    /** 取消信号。 */
    signal?: AbortSignal
    /** 分块之间的让出回调。 */
    yieldToEventLoop: () => Promise<void>
  },
) => Promise<AnalysisJobResult>

/** 创建分析作业宿主的配置。 */
export interface AnalysisJobHostOptions {
  /**
   * 进程内同步执行器。
   *
   * 仅用于自定义同步实现；提供本项而未提供 `executeCooperative` 时，降级
   * 路径沿用该执行器，只能在作业完成后观察取消。
   */
  execute?: (job: AnalysisJob) => AnalysisJobResult
  /**
   * 进程内协作式执行器。
   *
   * 缺省使用 {@link executeAnalysisJobCooperatively}；提供自定义 `execute`
   * 而未提供本项时，降级路径沿用同步执行器，只能在完成后观察取消。
   */
  executeCooperative?: CooperativeAnalysisExecutor
  /** Worker 工厂，缺省在运行环境支持时创建独立线程 Worker。 */
  createWorker?: AnalysisWorkerFactory
  /** 同时执行的 Worker 数量上限，缺省为 4。 */
  maxWorkers?: number
  /**
   * 排队作业数量上限，缺省为 128。
   *
   * 达到上限后新作业以 `Arc3DError("QUEUE_FULL")` 拒绝；传入
   * `Infinity` 可显式关闭背压。`0` 表示不允许排队，槽位已满时立即拒绝。
   */
  maxQueue?: number
  /**
   * 空闲 Worker 回收时间，单位为毫秒，默认为 30000。
   *
   * 作业完成后 Worker 进入空闲池；超过该时间仍未被复用时自动终止，降低
   * 多实例场景下的常驻内存。设置为 0 表示禁用空闲回收。
   */
  idleTimeoutMs?: number
}

/**
 * 校验 Worker 数量上限。
 * @param value - 调用方传入的上限。
 * @returns 合法的 Worker 数量上限。
 * @throws {Arc3DError} 上限不是大于等于 1 的整数时抛出。
 */
function resolveMaxWorkers(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_WORKERS
  if (!Number.isInteger(value) || value < 1) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `maxWorkers must be an integer greater than or equal to 1: ${value}`,
    )
  }
  return value
}

/**
 * 校验排队数量上限。
 * @param value - 调用方传入的上限。
 * @returns 合法的排队数量上限，可能是 `Infinity`。
 * @throws {Arc3DError} 上限不是大于等于 0 的整数或 `Infinity` 时抛出。
 */
function resolveMaxQueue(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_QUEUE
  if (value === Number.POSITIVE_INFINITY) return value
  if (!Number.isInteger(value) || value < 0) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `maxQueue must be an integer greater than or equal to 0, or Infinity: ${value}`,
    )
  }
  return value
}

/**
 * 校验并解析空闲回收时间。
 * @param value - 调用方传入的空闲回收时间。
 * @returns 毫秒数；0 表示禁用回收。
 * @throws {Arc3DError} 数值不是 0 到 2147483647 之间的整数时抛出。
 */
function resolveIdleTimeout(value: number | undefined): number {
  if (value === undefined) return DEFAULT_IDLE_TIMEOUT_MS
  if (!Number.isInteger(value) || value < 0 || value > MAX_IDLE_TIMEOUT_MS) {
    throw new Arc3DError(
      "INVALID_ARGUMENT",
      `idleTimeoutMs must be an integer between 0 and ${MAX_IDLE_TIMEOUT_MS}: ${value}`,
    )
  }
  return value
}

/**
 * 避免空闲回收定时器阻止 Node.js 进程退出；浏览器定时器没有 `unref`。
 * @param timer - 定时器句柄。
 */
function unrefTimer(timer: ReturnType<typeof setTimeout>): void {
  const handle = timer as ReturnType<typeof setTimeout> & { unref?: () => void }
  handle.unref?.()
}

/**
 * 在支持的环境创建独立线程 Worker。
 * @returns Worker 实例；运行环境不具备 `Worker` 或创建失败时返回 undefined。
 */
function createDefaultWorker(): AnalysisWorkerLike | undefined {
  if (typeof Worker === "undefined") return undefined
  try {
    return new Worker(new URL("./analysis-worker-entry.ts", import.meta.url), {
      type: "module",
    }) as unknown as AnalysisWorkerLike
  } catch {
    return undefined
  }
}

/**
 * 校验作业是否可结构化克隆，并返回独立副本。
 *
 * 返回的副本是后续校验、排队与投递的唯一数据来源，调用方在 `run` 返回后
 * 修改原对象不会影响已提交的作业。运行环境必须提供 `structuredClone`。
 *
 * @param job - 待校验的作业。
 * @returns 作业的独立副本。
 * @throws {Arc3DError} 运行环境缺少 `structuredClone` 时抛出 `UNSUPPORTED_CAPABILITY`；作业不可克隆时抛出 `INVALID_FORMAT`。
 */
function cloneJob(job: AnalysisJob): AnalysisJob {
  const clone = globalThis.structuredClone
  if (typeof clone !== "function") {
    throw new Arc3DError(
      "UNSUPPORTED_CAPABILITY",
      "AnalysisJobHost requires structuredClone (Node >=22 or a browser with structuredClone support)",
    )
  }
  try {
    return clone(job)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Arc3DError(
      "INVALID_FORMAT",
      `Analysis job must be structured-cloneable: ${detail}`,
    )
  }
}

/**
 * 运行纯数值分析作业的宿主。
 *
 * 宿主维护一个可配置上限的 Worker 池，每个在途作业独占一个 Worker 槽位；
 * 作业完成后槽位回到空闲池复用，超出容量的作业排队等待。队列长度同样可
 * 配置，达到上限后新作业以 `QUEUE_FULL` 拒绝，避免无界累积。
 * Worker 路径下取消只影响该作业独占的 Worker，不会波及其他并发作业。
 *
 * 调度与取消契约：
 * 1. 作业与结果必须可结构化克隆，不可克隆的输入在 `run` 前以
 *    `INVALID_FORMAT` 拒绝；`run` 会保存一份独立快照，调用方后续修改
 *    原对象不会影响已提交的作业。
 * 2. Worker 路径的取消会终止该作业独占的 Worker，实现强制中断，并以
 *    `Arc3DError("CANCELLED")` 拒绝；其他在途作业继续运行，排队作业由
 *    释放的槽位继续调度。主线程降级路径只能协作式取消：可分块作业在块间
 *    检查取消，无法分块的同步作业只能在开始前或完成后观察取消。
 * 3. 运行环境不提供 `Worker`、Worker 创建失败，或 Worker 异步加载/运行
 *    故障时，作业降级为进程内执行。降级路径同样受 `maxWorkers` 与
 *    `maxQueue` 约束，避免主线程被无界并发占满。异步故障会缓存为 Worker
 *    不可用，避免后续请求重复创建失败的 Worker；工作线程通过消息回传的
 *    业务错误仍原样返回，不做重试。
 * 4. 跨线程错误沿用 {@link serializeAnalysisError} / {@link restoreAnalysisError}，
 *    保持 `Arc3DError` 错误码不丢失。
 * 5. 队列达到 `maxQueue` 时，新作业以 `Arc3DError("QUEUE_FULL")` 拒绝；
 *    {@link getDiagnostics} 暴露 Worker 活动数、队列深度、取消/失败计数与
 *    执行耗时统计。
 */
export class AnalysisJobHost {
  private seq = 0
  private pending = new Map<number, PendingEntry>()
  private queue: number[] = []
  private slots = new Set<WorkerSlot>()
  private idle: WorkerSlot[] = []
  private terminated = false
  private workerUnavailable = false
  private inProcessJobs = 0
  private createdWorkers = 0
  private reclaimedWorkers = 0
  private peakWorkers = 0
  private startedJobs = 0
  private completedJobs = 0
  private cancelledJobs = 0
  private failedJobs = 0
  private rejectedJobs = 0
  private protocolErrors = 0
  private timedJobs = 0
  private totalExecutionMs = 0
  private maxExecutionMs = 0
  private lastExecutionMs = 0
  private readonly executeCooperative: CooperativeAnalysisExecutor
  private readonly inProcessCancellation: "cooperative" | "completion-only"
  private readonly createWorker: AnalysisWorkerFactory
  private readonly maxWorkers: number
  private readonly maxQueue: number
  private readonly idleTimeoutMs: number

  /**
   * 创建分析作业宿主。
   * @param options - 宿主配置，缺省使用进程内执行器与默认 Worker 工厂。
   * @throws {Arc3DError} `maxWorkers` 或 `maxQueue` 超出允许范围时抛出。
   */
  constructor(options: AnalysisJobHostOptions = {}) {
    const execute = options.execute
    this.executeCooperative =
      options.executeCooperative ??
      (execute ? async (job) => execute(job) : executeAnalysisJobCooperatively)
    this.inProcessCancellation =
      options.executeCooperative || !execute ? "cooperative" : "completion-only"
    this.createWorker = options.createWorker ?? createDefaultWorker
    this.maxWorkers = resolveMaxWorkers(options.maxWorkers)
    this.maxQueue = resolveMaxQueue(options.maxQueue)
    this.idleTimeoutMs = resolveIdleTimeout(options.idleTimeoutMs)
  }

  /**
   * 异步运行一个分析作业，支持取消。
   *
   * 每个在途作业独占一个 Worker 槽位，取消信号只影响传入它的作业。
   *
   * @param job - 待运行的分析作业。
   * @param options - 任务选项，包含取消信号。
   * @returns 作业执行结果。
   * @throws {Arc3DError} 宿主已终止、作业被取消、队列已满或输入不可克隆时抛出。
   */
  async run(
    job: AnalysisJob,
    options?: AnalysisTaskOptions,
  ): Promise<AnalysisJobResult> {
    if (this.terminated) {
      throw new Arc3DError("CANCELLED", "Analysis worker terminated")
    }
    if (options?.signal?.aborted) {
      throw new Arc3DError("CANCELLED", "Cancelled analysis job")
    }
    const jobSnapshot = cloneJob(job)
    const id = (this.seq += 1)
    return new Promise<AnalysisJobResult>((resolve, reject) => {
      const entry: PendingEntry = {
        job: jobSnapshot,
        options,
        resolve,
        reject,
        cleanup: () => undefined,
      }
      const onAbort = () => this.cancel(id)
      entry.cleanup = () =>
        options?.signal?.removeEventListener("abort", onAbort)
      this.pending.set(id, entry)
      options?.signal?.addEventListener("abort", onAbort, { once: true })
      this.dispatch(id)
    })
  }

  /** 终止宿主、终止全部 Worker 并拒绝所有未完成的作业。 */
  destroy(): void {
    if (this.terminated) return
    this.terminated = true
    this.queue = []
    this.rejectAll(new Arc3DError("CANCELLED", "Analysis worker terminated"))
    for (const slot of Array.from(this.slots)) {
      this.dropSlot(slot)
    }
  }

  /**
   * 获取当前运行诊断快照。
   * @returns Worker、队列、执行计数与耗时统计快照。
   */
  getDiagnostics(): AnalysisJobHostDiagnostics {
    let runningJobs = 0
    for (const slot of this.slots) {
      if (slot.jobId !== undefined) runningJobs += 1
    }
    return {
      maxWorkers: this.maxWorkers,
      maxQueue: this.maxQueue,
      activeWorkers: this.slots.size,
      idleWorkers: this.idle.length,
      createdWorkers: this.createdWorkers,
      reclaimedWorkers: this.reclaimedWorkers,
      peakWorkers: this.peakWorkers,
      idleTimeoutMs: this.idleTimeoutMs,
      runningJobs,
      queuedJobs: this.queue.length,
      inProcessJobs: this.inProcessJobs,
      inProcessCancellation: this.inProcessCancellation,
      pendingJobs: this.pending.size,
      startedJobs: this.startedJobs,
      completedJobs: this.completedJobs,
      cancelledJobs: this.cancelledJobs,
      failedJobs: this.failedJobs,
      rejectedJobs: this.rejectedJobs,
      protocolErrors: this.protocolErrors,
      timedJobs: this.timedJobs,
      totalExecutionMs: this.totalExecutionMs,
      averageExecutionMs:
        this.timedJobs === 0 ? 0 : this.totalExecutionMs / this.timedJobs,
      maxExecutionMs: this.maxExecutionMs,
      lastExecutionMs: this.lastExecutionMs,
      workerUnavailable: this.workerUnavailable,
      terminated: this.terminated,
    }
  }

  /**
   * 调度一个待执行作业。
   * @param id - 作业标识。
   */
  private dispatch(id: number): void {
    const entry = this.pending.get(id)
    if (!entry) return
    if (this.workerUnavailable) {
      this.dispatchInProcess(id)
      return
    }
    const slot = this.acquireSlot()
    if (slot === null) {
      this.enqueue(id)
      return
    }
    if (slot === undefined) {
      this.dispatchInProcess(id)
      return
    }
    this.post(id, slot)
  }

  /**
   * 调度一个进程内降级作业，并按 `maxWorkers` 限制并发。
   * @param id - 作业标识。
   */
  private dispatchInProcess(id: number): void {
    if (this.inProcessJobs < this.maxWorkers && this.queue.length === 0) {
      this.runInProcess(id)
      return
    }
    this.enqueue(id)
  }

  /**
   * 将作业加入等待队列，并在队列已满时以 `QUEUE_FULL` 拒绝。
   * @param id - 作业标识。
   */
  private enqueue(id: number): void {
    if (this.queue.length >= this.maxQueue) {
      this.rejectedJobs += 1
      this.settle(
        id,
        new Arc3DError(
          "QUEUE_FULL",
          `Analysis job queue is full (maxQueue: ${this.maxQueue})`,
        ),
      )
      return
    }
    this.queue.push(id)
  }

  /**
   * 从空闲池获取槽位，或在容量允许时创建新 Worker。
   * @returns 可用槽位；`null` 表示池已满；`undefined` 表示 Worker 不可用。
   */
  private acquireSlot(): WorkerSlot | null | undefined {
    const reused = this.idle.pop()
    if (reused) {
      this.clearIdleTimer(reused)
      return reused
    }
    if (this.slots.size >= this.maxWorkers) return null
    let worker: AnalysisWorkerLike | undefined
    try {
      worker = this.createWorker()
    } catch {
      worker = undefined
    }
    if (!worker) {
      this.workerUnavailable = true
      return undefined
    }
    const slot: WorkerSlot = { worker }
    worker.onmessage = (event) => this.handleMessage(slot, event.data)
    worker.onerror = (event) => this.handleWorkerError(slot, event)
    worker.onmessageerror = (event) => this.handleWorkerError(slot, event)
    this.slots.add(slot)
    this.createdWorkers += 1
    if (this.slots.size > this.peakWorkers) this.peakWorkers = this.slots.size
    return slot
  }

  /**
   * 把作业投递到指定槽位。
   * @param id - 作业标识。
   * @param slot - 已分配的空闲槽位。
   */
  private post(id: number, slot: WorkerSlot): void {
    const entry = this.pending.get(id)
    if (!entry) {
      this.releaseSlot(slot)
      return
    }
    entry.slot = slot
    slot.jobId = id
    this.markStarted(entry)
    try {
      slot.worker.postMessage({ id, job: entry.job })
      this.startedJobs += 1
    } catch (error) {
      entry.slot = undefined
      this.dropSlot(slot)
      const detail = error instanceof Error ? error.message : String(error)
      this.settle(
        id,
        new Arc3DError(
          "ENGINE_FAILURE",
          `Failed to post analysis job to worker: ${detail}`,
        ),
      )
      this.pump()
    }
  }

  /**
   * 在进程内执行作业，用于 Worker 不可用的降级路径。
   *
   * 取消语义与 Worker 路径不同：无法终止同步执行，只能通过协作式执行器
   * 在分块边界观察取消。可分块的作业可在块间中断，其余作业只能在开始前
   * 或完成后响应取消。
   *
   * @param id - 作业标识。
   */
  private runInProcess(id: number): void {
    this.inProcessJobs += 1
    queueMicrotask(() => {
      void this.runInProcessJob(id)
    })
  }

  /**
   * 执行一个进程内降级作业。
   * @param id - 作业标识。
   */
  private async runInProcessJob(id: number): Promise<void> {
    const entry = this.pending.get(id)
    if (!entry) {
      this.inProcessJobs -= 1
      this.pump()
      return
    }
    if (entry.options?.signal?.aborted) {
      this.inProcessJobs -= 1
      this.settle(id, new Arc3DError("CANCELLED", "Cancelled analysis job"))
      this.pump()
      return
    }
    this.markStarted(entry)
    this.startedJobs += 1
    try {
      const result = await this.executeCooperative(entry.job, {
        signal: entry.options?.signal,
        yieldToEventLoop: () => yieldToEventLoop(entry.options?.yieldStrategy),
      })
      if (entry.options?.signal?.aborted) {
        this.settle(id, new Arc3DError("CANCELLED", "Cancelled analysis job"))
        return
      }
      this.settle(id, undefined, result)
    } catch (error) {
      this.settle(id, error)
    } finally {
      this.inProcessJobs -= 1
      this.pump()
    }
  }

  /**
   * 处理 Worker 返回的消息。
   *
   * 消息在结算前经过运行时校验：任务标识、结果/错误二选一、错误码与结果
   * 结构都必须合法。可归属到当前槽位的畸形响应以 `INVALID_FORMAT` 结算
   * 并终止槽位；无法归属的畸形消息只计入 `protocolErrors`，不会让任务
   * 永久挂起。
   *
   * @param slot - 消息所属槽位。
   * @param data - Worker 回传的响应。
   */
  private handleMessage(slot: WorkerSlot, data: unknown): void {
    const parsed = parseAnalysisWorkerResponse(data)
    if (parsed.kind === "invalid") {
      this.protocolErrors += 1
      if (parsed.id !== undefined) {
        this.failProtocol(slot, parsed.id, parsed.reason)
      }
      return
    }
    const message = parsed.response
    const entry = this.pending.get(message.id)
    if (!entry || entry.slot !== slot) return
    if ("error" in message) {
      this.settle(message.id, restoreAnalysisError(message.error))
    } else if (!isAnalysisJobResult(message.result, entry.job)) {
      this.protocolErrors += 1
      this.failProtocol(
        slot,
        message.id,
        "result does not match the requested job",
      )
      return
    } else {
      this.settle(message.id, undefined, message.result)
    }
    this.pump()
  }

  /**
   * 处理可归属到当前槽位的畸形响应。
   *
   * 终止该槽位并以 `INVALID_FORMAT` 结算任务，避免错误结果被当作成功。
   * 新作业会重新创建 Worker；协议故障不会永久禁用 Worker 路径。
   *
   * @param slot - 消息所属槽位。
   * @param id - 消息中的任务标识。
   * @param reason - 校验失败原因。
   */
  private failProtocol(slot: WorkerSlot, id: number, reason: string): void {
    const entry = this.pending.get(id)
    if (!entry || entry.slot !== slot) return
    entry.slot = undefined
    this.dropSlot(slot)
    this.settle(
      id,
      new Arc3DError(
        "INVALID_FORMAT",
        `Malformed analysis worker response: ${reason}`,
      ),
    )
    this.pump()
  }

  /**
   * 处理 Worker 的异步错误（脚本加载失败、CSP 拦截或线程崩溃）。
   *
   * 作业逻辑自身的错误由工作线程捕获后以消息回传，不会进入此路径；因此
   * 这里视为 Worker 基础设施故障：缓存不可用状态，并把当前作业回退到
   * 进程内重放一次。后续作业直接走降级路径，避免反复创建失败的 Worker。
   *
   * @param slot - 出错的槽位。
   * @param event - Worker 错误事件。
   */
  private handleWorkerError(slot: WorkerSlot, event: unknown): void {
    const jobId = slot.jobId
    this.dropSlot(slot)
    this.markWorkerUnavailable()
    if (jobId !== undefined) {
      const entry = this.pending.get(jobId)
      if (entry) {
        entry.slot = undefined
        this.dispatchInProcess(jobId)
      }
    }
    this.pump()
  }

  /**
   * 标记 Worker 不可用，并释放空闲槽位供后续作业降级执行。
   */
  private markWorkerUnavailable(): void {
    this.workerUnavailable = true
    for (const slot of Array.from(this.idle)) {
      this.dropSlot(slot)
    }
  }

  /**
   * 取消单个作业；仅终止该作业独占的 Worker。
   * @param id - 作业标识。
   */
  private cancel(id: number): void {
    const entry = this.pending.get(id)
    if (!entry) return
    const slot = entry.slot
    entry.slot = undefined
    if (slot) this.dropSlot(slot)
    this.settle(id, new Arc3DError("CANCELLED", "Cancelled analysis job"))
    this.pump()
  }

  /**
   * 继续调度排队中的作业。
   */
  private pump(): void {
    while (this.queue.length > 0) {
      if (this.workerUnavailable && this.inProcessJobs >= this.maxWorkers) {
        return
      }
      const id = this.queue.shift() as number
      if (!this.pending.has(id)) continue
      if (this.workerUnavailable) {
        this.runInProcess(id)
        continue
      }
      const slot = this.acquireSlot()
      if (slot === null) {
        this.queue.unshift(id)
        return
      }
      if (slot === undefined) {
        this.runInProcess(id)
        continue
      }
      this.post(id, slot)
    }
  }

  /**
   * 完成一个作业并释放其槽位。
   * @param id - 作业标识。
   * @param error - 可选错误；省略时按成功处理。
   * @param result - 成功时的结果。
   */
  private settle(
    id: number,
    error?: unknown,
    result?: AnalysisJobResult,
  ): void {
    const entry = this.pending.get(id)
    if (!entry) return
    this.pending.delete(id)
    this.removeFromQueue(id)
    this.recordExecution(entry)
    entry.cleanup()
    if (entry.slot) {
      this.releaseSlot(entry.slot)
      entry.slot = undefined
    }
    if (error !== undefined) {
      const failure =
        error instanceof Arc3DError
          ? error
          : restoreAnalysisError(serializeAnalysisError(error))
      if (failure.code === "CANCELLED") this.cancelledJobs += 1
      else this.failedJobs += 1
      entry.reject(failure)
      return
    }
    this.completedJobs += 1
    entry.resolve(result as AnalysisJobResult)
  }

  /**
   * 记录作业首次开始执行的时间。
   * @param entry - 待执行作业。
   */
  private markStarted(entry: PendingEntry): void {
    if (entry.startedAt === undefined) entry.startedAt = Date.now()
  }

  /**
   * 将已开始作业的耗时纳入统计；从未开始的作业不产生样本。
   * @param entry - 已结束作业。
   */
  private recordExecution(entry: PendingEntry): void {
    if (entry.startedAt === undefined) return
    const duration = Math.max(0, Date.now() - entry.startedAt)
    entry.startedAt = undefined
    this.timedJobs += 1
    this.totalExecutionMs += duration
    this.lastExecutionMs = duration
    if (duration > this.maxExecutionMs) this.maxExecutionMs = duration
  }

  /**
   * 从排队列表移除指定作业。
   * @param id - 作业标识。
   */
  private removeFromQueue(id: number): void {
    const index = this.queue.indexOf(id)
    if (index >= 0) this.queue.splice(index, 1)
  }

  /**
   * 将槽位标记为空闲，供后续作业复用。
   * @param slot - 待释放的槽位。
   */
  private releaseSlot(slot: WorkerSlot): void {
    slot.jobId = undefined
    if (!this.slots.has(slot)) return
    if (this.workerUnavailable) {
      this.dropSlot(slot)
      return
    }
    if (!this.idle.includes(slot)) this.idle.push(slot)
    this.scheduleIdleReclaim(slot)
  }

  /**
   * 为空闲槽位安排回收定时器。
   * @param slot - 刚进入空闲状态的槽位。
   */
  private scheduleIdleReclaim(slot: WorkerSlot): void {
    if (this.idleTimeoutMs === 0 || this.terminated) return
    this.clearIdleTimer(slot)
    const timer = setTimeout(() => {
      slot.idleTimer = undefined
      if (
        this.terminated ||
        slot.jobId !== undefined ||
        !this.idle.includes(slot)
      ) {
        return
      }
      this.idle = this.idle.filter((item) => item !== slot)
      this.reclaimedWorkers += 1
      this.dropSlot(slot)
    }, this.idleTimeoutMs)
    unrefTimer(timer)
    slot.idleTimer = timer
  }

  /**
   * 清除槽位的空闲回收定时器。
   * @param slot - 目标槽位。
   */
  private clearIdleTimer(slot: WorkerSlot): void {
    if (slot.idleTimer === undefined) return
    clearTimeout(slot.idleTimer)
    slot.idleTimer = undefined
  }

  /**
   * 终止并移除一个槽位。
   * @param slot - 待移除的槽位。
   */
  private dropSlot(slot: WorkerSlot): void {
    this.clearIdleTimer(slot)
    this.slots.delete(slot)
    this.idle = this.idle.filter((item) => item !== slot)
    slot.jobId = undefined
    slot.worker.onmessage = null
    slot.worker.onerror = null
    slot.worker.onmessageerror = null
    try {
      slot.worker.terminate()
    } catch {
      // 终止失败不影响宿主状态。
    }
  }

  /**
   * 拒绝所有未完成的作业，用于宿主销毁。
   * @param error - 拒绝原因。
   */
  private rejectAll(error: Arc3DError): void {
    const entries = Array.from(this.pending.values())
    this.pending.clear()
    for (const entry of entries) {
      this.recordExecution(entry)
      entry.cleanup()
      if (error.code === "CANCELLED") this.cancelledJobs += 1
      else this.failedJobs += 1
      entry.reject(error)
    }
  }
}
