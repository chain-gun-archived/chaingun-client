import { ChainGunLink } from './ChainGunLink'
import { diffGunCRDT } from './Graph/GunGraphUtils'
import { GunGraph } from './Graph/GunGraph'
import { WebSocketGraphConnector } from './Transports/WebSocketGraphConnector'

interface ChainGunOptions {
  peers?: string[]
  graph?: GunGraph
  WS?: typeof WebSocket
}

/**
 * Main entry point for ChainGun
 *
 * Usage:
 *
 *   const gun = new ChainGun({ peers: ["https://notabug.io/gun"]})
 *   gun.get("nab/things/59382d2a08b7d7073415b5b6ae29dfe617690d74").on(thing => console.log(this))
 */
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

  /**
   * Set ChainGun configuration options
   *
   * @param options
   */
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
  get(soul: string, cb?: GunMsgCb): ChainGunLink {
    return new this.LinkClass(this, soul)
  }
}
