import { ChainGunLink } from './ChainGunLink'
import { diffGunCRDT } from './diffGunCRDT'
import { GunGraph } from './GunGraph'
import { addMissingState } from './addMissingState'
import { WebSocketGraphConnector } from './@notabug/chaingun'

interface ChainGunOptions {
  peers?: string[]
  graph?: GunGraph
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
      options.peers.forEach(peer => this.graph.connect(new WebSocketGraphConnector(peer)))
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

  /**
   * Write node data
   *
   * @param data one or more gun nodes keyed by soul
   */
  put(data: { [soul: string]: GunNode }) {
    throw new Error("put() isn't supported yet")
    return this
  }
}
