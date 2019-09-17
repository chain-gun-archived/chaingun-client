import { GunEvent } from './GunEvent'
import { mergeGunNodes } from './mergeGunNodes'
import { diffSets } from './diffSets'
import { GunGraphConnector } from './GunGraphConnector'
import { flattenGraphData } from './flattenGraphData'
import { addMissingState } from './addMissingState'

interface GunGraphOptions {}

export class GunGraph {
  private _opt: GunGraphOptions
  private _connectors: GunGraphConnector[]
  private _readMiddleware: ChainGunMiddleware[]
  private _writeMiddleware: ChainGunMiddleware[]
  private _graph: GunGraphData
  private _listeners: {
    [soul: string]: GunEvent<GunNode | undefined, string>
  }

  constructor() {
    this.receiveNodeData = this.receiveNodeData.bind(this)
    this._opt = {}
    this._graph = {}
    this._connectors = []
    this._listeners = {}
    this._readMiddleware = []
    this._writeMiddleware = []
  }

  opt(options: GunGraphOptions) {
    this._opt = { ...this._opt, ...options }
    return this
  }

  connect(connector: GunGraphConnector) {
    if (this._connectors.indexOf(connector) !== -1) return this
    connector.graphData.on(this.receiveNodeData)
    this._connectors.push(connector)
    return this
  }

  disconnect(connector: GunGraphConnector) {
    const idx = this._connectors.indexOf(connector)
    connector.graphData.off(this.receiveNodeData)
    if (idx !== -1) this._connectors.splice(idx, 1)
    return this
  }

  /**
   * Register graph middleware
   *
   * @param middleware The middleware function to add
   * @param kind Optionaly register write middleware instead of read by passing "write"
   */
  use(middleware: ChainGunMiddleware, kind = 'read' as ChainGunMiddlewareType) {
    if (kind === 'read') {
      this._readMiddleware.push(middleware)
    } else if (kind === 'write') {
      this._writeMiddleware.push(middleware)
    }
    return this
  }

  /**
   * Unregister graph middleware
   *
   * @param middleware The middleware function to remove
   * @param kind Optionaly unregister write middleware instead of read by passing "write"
   */
  unuse(middleware: ChainGunMiddleware, kind = 'read' as ChainGunMiddlewareType) {
    if (kind === 'read') {
      const idx = this._readMiddleware.indexOf(middleware)
      if (idx !== -1) this._readMiddleware.splice(idx, 1)
    } else if (kind === 'write') {
      const idx = this._writeMiddleware.indexOf(middleware)
      if (idx !== -1) this._writeMiddleware.splice(idx, 1)
    }

    return this
  }

  /**
   * Update node data in this chain from some local or external source
   *
   * @param soul soul of node to update
   * @param data node data to include
   */
  private async receiveNodeData(data?: GunGraphData) {
    let diff = data

    for (let i = 0; i < this._readMiddleware.length; i++) {
      if (!diff) return
      diff = await this._readMiddleware[i](diff, this._graph)
    }

    if (!diff) return

    const souls = Object.keys(diff)
    for (let i = 0; i < souls.length; i++) {
      const soul = souls[i]
      const listener = this._listeners[soul]

      if (!listener) {
        this._forget(soul)
        continue
      }

      const node = (this._graph[soul] = mergeGunNodes(this._graph[soul], diff[soul]))

      listener.trigger(node, soul)
    }
  }

  query(path: string[], cb: GunOnCb) {
    let lastSouls = [] as string[]
    let currentValue: GunValue | undefined

    const updateQuery = () => {
      const { souls, value, complete } = this._getPathData(path)
      const [added, removed] = diffSets(lastSouls, souls)

      if (
        (complete && typeof currentValue === 'undefined') ||
        (typeof value !== 'undefined' && value !== currentValue)
      ) {
        currentValue = value
        cb(value, path[path.length - 1])
      }

      added.forEach(soul => this._request(soul, updateQuery))
      removed.forEach(soul => this._unlisten(soul, updateQuery))
    }

    updateQuery()
    return () => {
      lastSouls.forEach(soul => this._unlisten(soul, updateQuery))
    }
  }

  /**
   * Write node data
   *
   * @param data one or more gun nodes keyed by soul
   */
  async put(data: GunGraphData) {
    let diff: GunGraphData | undefined = flattenGraphData(addMissingState(data))

    for (let i = 0; i < this._writeMiddleware.length; i++) {
      if (!diff) return
      diff = await this._writeMiddleware[i](diff, this._graph)
    }

    if (!diff) return

    for (let i = 0; i < this._connectors.length; i++) {
      this._connectors[i].put(diff)
    }

    this.receiveNodeData(diff)
  }

  private _forget(soul: string) {
    if (this._listeners[soul]) {
      this._listeners[soul].reset()
      delete this._listeners[soul]
    }
    delete this._graph[soul]
    return this
  }

  private _request(soul: string, cb: GunNodeListenCb) {
    this._listen(soul, cb)
    const souls = [soul]
    for (let i = 0; i < this._connectors.length; i++) {
      this._connectors[i].request(souls)
    }
  }

  private _listen(soul: string, cb: GunNodeListenCb) {
    let listener = this._listeners[soul]
    if (!listener) {
      listener = this._listeners[soul] = new GunEvent(soul)
    }
    listener.on(cb)
    return () => this._unlisten(soul, cb)
  }

  private _unlisten(soul: string, cb: GunNodeListenCb) {
    let listener = this._listeners[soul]
    if (listener) listener.off(cb)
    if (listener.listenerCount() <= 0) this._forget(soul)
  }

  private _getPathData(keys: string[]): PathData {
    const lastKey = keys[keys.length - 1]

    if (keys.length === 1) {
      return {
        souls: keys,
        value: this._graph[lastKey],
        complete: lastKey in this._graph
      }
    }

    const { value: parentValue, souls } = this._getPathData(keys.slice(0, keys.length - 1))

    if (typeof parentValue !== 'object') {
      return {
        souls,
        value: undefined,
        complete: typeof parentValue !== 'undefined'
      }
    }

    const value = (parentValue as GunNode)[lastKey]

    if (!value) {
      return {
        souls,
        value: value,
        complete: true
      }
    }

    const edgeSoul = value['#']

    if (edgeSoul) {
      return {
        souls: [...souls, edgeSoul],
        value: this._graph[edgeSoul],
        complete: edgeSoul in this._graph
      }
    }

    return {
      souls,
      value,
      complete: true
    }
  }
}
