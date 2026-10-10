import * as Cesium from "cesium"

export interface IonTokenScope {
  run<T>(token: string | undefined, work: () => Promise<T>): Promise<T>
}

export class SerialIonTokenScope implements IonTokenScope {
  private chain: Promise<unknown> = Promise.resolve()

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

export const sharedIonTokenScope = new SerialIonTokenScope()

export function withIonAccessToken<T>(
  token: string | undefined,
  work: () => Promise<T>,
  scope: IonTokenScope = sharedIonTokenScope,
): Promise<T> {
  return scope.run(token, work)
}

export function readIonToken(config: {
  engine?: { cesium?: { ionToken?: string } }
  tokens?: { cesiumIon?: string }
}): string | undefined {
  return config.engine?.cesium?.ionToken ?? config.tokens?.cesiumIon
}
