import { GunEvent } from '../ControlFlow/GunEvent'
import { GunGraphConnector } from '../Transports/GunGraphConnector'
import {
  mergeGunNodes,
  diffSets,
  flattenGraphData,
  addMissingState,
  generateMessageId,
  getPathData
} from './GunGraphUtils'
import { GunGraphNode } from './GunGraphNode'

interface GunGraphOptions {}

/**
 * High level management of a subset of the gun graph
 *
 * Provides facilities for querying and writing to graph data from one or more sources
 */
export class GunGraph {
  graphData: GunEvent<GunGraphData, string | undefined>
  activeConnectors: number

  private _opt: GunGraphOptions
  private _connectors: GunGraphConnector[]
  private _readMiddleware: ChainGunMiddleware[]
  private _writeMiddleware: ChainGunMiddleware[]
  private _graph: GunGraphData
  private _nodes: {
    [soul: string]: GunGraphNode
  }

  constructor() {
    this._receiveGraphData = this._receiveGraphData.bind(this)
    this.__onConnectorStatus = this.__onConnectorStatus.bind(this)
    this.activeConnectors = 0
    this.graphData = new GunEvent('graph data')
    this._opt = {}
    this._graph = {}
    this._nodes = {}
    this._connectors = []
    this._readMiddleware = []
    this._writeMiddleware = []
  }

  /**
   * Configure graph options
   *
   * Currently unused
   *
   * @param options
   */
  opt(options: GunGraphOptions) {
    this._opt = { ...this._opt, ...options }
    return this
  }

  /**
   * Connect to a source/destination for graph data
   *
   * @param connector the source or destination for graph data
   */
  connect(connector: GunGraphConnector) {
    if (this._connectors.indexOf(connector) !== -1) return this
    if (connector.isConnected) this.activeConnectors++
    connector.events.connection.on(this.__onConnectorStatus)
    connector.events.graphData.on(this._receiveGraphData)
    this._connectors.push(connector)
    return this
  }

  /**
   * Disconnect from a source/destination for graph data
   *
   * @param connector the source or destination for graph data
   */
  disconnect(connector: GunGraphConnector) {
    const idx = this._connectors.indexOf(connector)
    connector.events.graphData.off(this._receiveGraphData)
    connector.events.connection.off(this.__onConnectorStatus)
    if (idx !== -1) this._connectors.splice(idx, 1)
    if (connector.isConnected) this.activeConnectors--
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
   * Read a potentially multi-level deep path from the graph
   *
   * @param path The path to read
   * @param cb The callback to invoke with results
   * @returns a cleanup function to after done with query
   */
  query(path: string[], cb: GunOnCb) {
    let lastSouls = [] as string[]
    let currentValue: GunValue | undefined

    const updateQuery = () => {
      const { souls, value, complete } = getPathData(path, this._graph)
      const [added, removed] = diffSets(lastSouls, souls)

      if (
        (complete && typeof currentValue === 'undefined') ||
        (typeof value !== 'undefined' && value !== currentValue)
      ) {
        currentValue = value
        cb(value, path[path.length - 1])
      }

      for (let i = 0; i < added.length; i++) {
        this._requestSoul(added[i], updateQuery)
      }

      for (let i = 0; i < removed.length; i++) {
        this._unlistenSoul(removed[i], updateQuery)
      }

      lastSouls = souls
    }

    updateQuery()
    return () => {
      for (let i = 0; i < lastSouls.length; i++) {
        this._unlistenSoul(lastSouls[i], updateQuery)
      }
    }
  }

  /**
   * Write graph data to a potentially multi-level deep path in the graph
   *
   * @param path The path to read
   * @param data The value to write
   * @param cb Callback function to be invoked for write acks
   * @returns a cleanup function to after done with query
   */
  putPath(path: string[], data: GunValue, cb?: GunMsgCb) {
    if (path.length === 1) {
      if (data && typeof data === 'object') {
        this.put(
          {
            [path[0]]: data as GunNode
          },
          cb
        )
      }
      return
    }
    const lastKey = path[path.length - 1]
    const parentPath = path.slice(0, path.length - 1)

    let lastSouls = [] as string[]

    const end = () => {
      for (let i = 0; i < lastSouls.length; i++) {
        this._unlistenSoul(lastSouls[i], updateQuery)
      }
      lastSouls = []
    }

    const updateQuery = () => {
      const { souls, complete } = getPathData(path, this._graph)
      const [added, removed] = diffSets(lastSouls, souls)

      if (complete) {
        if (souls.length === parentPath.length) {
          const lastSoul = souls[souls.length - 1]
          this.putPath([lastSoul], { [lastKey]: data }, cb)
        } else {
          throw new Error('Deep puts only partially supported')
        }
        end()
      } else {
        for (let i = 0; i < added.length; i++) {
          this._requestSoul(added[i], updateQuery)
        }

        for (let i = 0; i < removed.length; i++) {
          this._unlistenSoul(removed[i], updateQuery)
        }
      }

      lastSouls = souls
    }

    updateQuery()
    return end
  }

  /**
   * Write node data
   *
   * @param data one or more gun nodes keyed by soul
   */
  async put(data: GunGraphData, cb?: GunMsgCb) {
    let diff: GunGraphData | undefined = flattenGraphData(addMissingState(data))

    for (let i = 0; i < this._writeMiddleware.length; i++) {
      if (!diff) return
      diff = await this._writeMiddleware[i](diff, this._graph)
    }

    if (!diff) return

    const msgId = generateMessageId()

    for (let i = 0; i < this._connectors.length; i++) {
      this._connectors[i].put({
        msgId,
        graph: diff,
        cb
      })
    }

    const souls = Object.keys(diff)

    for (let i = 0; i < souls.length; i++) {
      this._node(souls[i])
    }

    this._receiveGraphData(diff)
  }

  /**
   * Synchronously invoke callback function for each connector to this graph
   *
   * @param cb The callback to invoke
   */
  eachConnector(cb: (connector: GunGraphConnector) => void) {
    for (let i = 0; i < this._connectors.length; i++) {
      cb(this._connectors[i])
    }
    return this
  }

  /**
   * Update graph data in this chain from some local or external source
   *
   * @param data node data to include
   */
  private async _receiveGraphData(data?: GunGraphData, replyToId?: string) {
    let diff = data

    for (let i = 0; i < this._readMiddleware.length; i++) {
      if (!diff) return
      diff = await this._readMiddleware[i](diff, this._graph)
    }

    if (!diff || !Object.keys(diff)) return

    const souls = Object.keys(diff)
    for (let i = 0; i < souls.length; i++) {
      const soul = souls[i]
      const node = this._nodes[soul]

      if (!node) {
        this._forgetSoul(soul)
        continue
      }

      const nodeData = (this._graph[soul] = mergeGunNodes(this._graph[soul], diff[soul]))

      if (node) node.receive(nodeData)
    }

    this.graphData.trigger(diff, replyToId)
  }

  private _node(soul: string) {
    return (this._nodes[soul] =
      this._nodes[soul] || new GunGraphNode(this, soul, this._receiveGraphData))
  }

  private _requestSoul(soul: string, cb: GunNodeListenCb) {
    this._node(soul).get(cb)
    return this
  }

  private _unlistenSoul(soul: string, cb: GunNodeListenCb) {
    const node = this._nodes[soul]
    if (!node) return this
    node.off(cb)
    if (node.listenerCount() <= 0) {
      node.off()
      this._forgetSoul(soul)
    }
    return this
  }

  private _forgetSoul(soul: string) {
    const node = this._nodes[soul]
    if (node) {
      node.off()
      delete this._nodes[soul]
    }
    delete this._graph[soul]
    return this
  }

  private __onConnectorStatus(connected?: boolean) {
    if (connected) {
      this.activeConnectors++
    } else {
      this.activeConnectors--
    }
  }
}
