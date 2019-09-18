import { ChainGunLink } from './ChainGunLink'
import { diffGunCRDT } from './diffGunCRDT'
import { GunGraph } from './GunGraph'
import { WebSocketGraphConnector } from './@notabug/chaingun'

interface ChainGunOptions {
  peers?: string[]
  graph?: GunGraph
  WS?: typeof WebSocket
}

export class ChainGun {
  graph: GunGraph
  private LinkClass: typeof ChainGunLink
  private _opt: ChainGunOptions

  constructor(opt?: ChainGunOptions, LinkClass = ChainGunLink) {
    if (opt && opt.graph) {
      this.graph = opt.graph
    } else {
      this.graph = new GunGraph()
      this.graph.use(diffGunCRDT)
      this.graph.use(diffGunCRDT, 'write')
    }
    this._opt = {}
    if (opt) this.opt(opt)

    this.LinkClass = LinkClass
  }

  opt(options: ChainGunOptions) {
    this._opt = { ...this._opt, ...options }

    if (options.peers) {
      options.peers.forEach(peer =>
        this.graph.connect(new WebSocketGraphConnector(peer, this._opt.WS))
      )
    }

    return this
  }

  /**
   * Traverse a location in the graph
   *
   * @param key Key to read data from
   * @param cb
   * @returns New chain context corresponding to given key
   */
  get(soul: string, cb?: GunPutCb): ChainGunLink {
    return new this.LinkClass(this, soul)
  }
}
