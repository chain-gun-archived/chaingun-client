import { GunGraph } from './GunGraph'
import { GunEvent } from '../ControlFlow/GunEvent'
import { generateMessageId } from './GunGraphUtils'

/**
 * Query state around a single node in the graph
 */
export class GunGraphNode {
  soul: string
  private _data: GunEvent<GunNode | undefined>
  private _graph: GunGraph
  private _endCurQuery?: () => void
  private _updateGraph: (data: GunGraphData, replyToId?: string) => void

  constructor(
    graph: GunGraph,
    soul: string,
    updateGraph: (data: GunGraphData, replyToId?: string) => void
  ) {
    this._data = new GunEvent<GunNode | undefined>(`<GunGraphNode ${soul}>`)
    this._graph = graph
    this._updateGraph = updateGraph
    this.soul = soul
  }

  listenerCount() {
    return this._data.listenerCount()
  }

  get(cb?: GunNodeListenCb) {
    if (cb) this.on(cb)
    this._ask()
    return this
  }

  receive(data: GunNode | undefined) {
    this._data.trigger(data, this.soul)
    return this
  }

  on(cb: (data: GunNode | undefined, soul: string) => void) {
    this._data.on(cb)
    return this
  }

  off(cb?: (data: GunNode | undefined, soul: string) => void) {
    if (cb) {
      this._data.off(cb)
    } else {
      this._data.reset()
    }

    if (this._endCurQuery && !this._data.listenerCount()) {
      this._endCurQuery()
      this._endCurQuery = undefined
    }

    return this
  }

  private _ask() {
    if (this._endCurQuery) return

    const endFns: (() => void)[] = []

    const msgId = generateMessageId()

    this._graph.eachConnector(connector => {
      endFns.push(
        connector.get({
          msgId,
          soul: this.soul,
          cb: this._onDirectQueryReply.bind(this)
        })
      )
    })

    this._endCurQuery = () => endFns.map(fn => fn())
    return this
  }

  private _onDirectQueryReply(msg: GunMsg) {
    if ('put' in msg && !msg.put) {
      this._updateGraph(
        {
          [this.soul]: undefined
        },
        msg['@']
      )
    }
  }
}
