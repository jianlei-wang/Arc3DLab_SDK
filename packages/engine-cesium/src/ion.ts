import * as Cesium from "cesium"

export async function withIonAccessToken<T>(token: string | undefined, work: () => Promise<T>): Promise<T> {
  if (!token) return work()
  const previous = Cesium.Ion.defaultAccessToken
  Cesium.Ion.defaultAccessToken = token
  try {
    return await work()
  } finally {
    Cesium.Ion.defaultAccessToken = previous
  }
}

export function readIonToken(config: {
  engine?: { cesium?: { ionToken?: string } }
  tokens?: { cesiumIon?: string }
}): string | undefined {
  return config.engine?.cesium?.ionToken ?? config.tokens?.cesiumIon
}
