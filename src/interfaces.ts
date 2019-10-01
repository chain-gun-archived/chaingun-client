interface GunNodeState {
  [key: string]: number
}

interface GunNode {
  _: {
    '#': string
    '>': GunNodeState
  }
  [key: string]: any
}

interface GunGraphData {
  [key: string]: GunNode | undefined
}

interface GunMsg {
  '#'?: string
  '@'?: string

  get?: {
    '#': string
  }

  put?: GunGraphData

  ack?: number | boolean
  err?: any
}

type GunValue = object | string | number | boolean | null
type GunChainOptions = {
  uuid?: (path: string[]) => Promise<string> | string
}
type SendFn = (msg: GunMsg) => void
type GunOnCb = (node: GunValue | undefined, key?: string) => void
type GunMsgCb = (msg: GunMsg) => void
type GunNodeListenCb = (node: GunNode | undefined) => void

interface PathData {
  souls: string[]
  value: GunValue | undefined
  complete: boolean
}

type ChainGunMiddleware = (
  updates: GunGraphData,
  existingGraph: GunGraphData
) => GunGraphData | undefined | Promise<GunGraphData | undefined>
type ChainGunMiddlewareType = 'read' | 'write'

interface ChainGunPut {
  graph: GunGraphData
  msgId?: string
  replyTo?: string
  cb?: GunMsgCb
}

interface ChainGunGet {
  soul: string
  msgId?: string
  key?: string
  cb?: GunMsgCb
}
