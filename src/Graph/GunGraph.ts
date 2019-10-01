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

interface GunGraphOptions {
  mutable?: boolean
}

/**
 * High level management of a subset of the gun graph
 *
 * Provides facilities for querying and writing to graph data from one or more sources
 */
export class GunGraph {
  id: string

  events: {
    graphData: GunEvent<GunGraphData, string | undefined, string | undefined>
    put: GunEvent<ChainGunPut>
    get: GunEvent<ChainGunGet>
    off: GunEvent<string>
  }

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
    this.id = generateMessageId()
    this._receiveGraphData = this._receiveGraphData.bind(this)
    this.__onConnectorStatus = this.__onConnectorStatus.bind(this)
    this.activeConnectors = 0
    this.events = {
      graphData: new GunEvent('graph data'),
      put: new GunEvent('put data'),
      get: new GunEvent('request soul'),
      off: new GunEvent('off event')
    }
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
    this._connectors.push(connector.connectToGraph(this))

    connector.events.connection.on(this.__onConnectorStatus)
    connector.events.graphData.on(this._receiveGraphData)

    if (connector.isConnected) this.activeConnectors++
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
   * @returns a promise
   */
  async putPath(
    fullPath: string[],
    data: GunValue,
    cb?: GunMsgCb,
    uuidFn?: (path: string[]) => Promise<string> | string
  ) {
    if (!fullPath.length) throw new Error('No path specified')
    const souls = await this.getPathSouls(fullPath)

    if (souls.length === fullPath.length) {
      return this.put(
        {
          [souls[souls.length - 1]]: data as GunNode
        },
        cb
      )
    }

    const existing = fullPath.slice(0, souls.length)
    const remaining = fullPath.slice(souls.length)
    let previousSoul = souls[souls.length - 1]
    const graph: GunGraphData = {}

    for (let i = 0; i < remaining.length; i++) {
      const now = new Date().getTime()
      const key = remaining[i]
      let chainVal: GunValue
      let soul = ''

      if (i === remaining.length - 1) {
        chainVal = data
      } else {
        if (!uuidFn) throw new Error('Must specify uuid function to put to incomplete path')
        soul = await uuidFn([...existing, ...remaining.slice(0, i + 1)])
        chainVal = {
          '#': soul
        }
      }

      graph[previousSoul] = {
        _: {
          '#': previousSoul,
          '>': {
            [key]: now
          }
        },
        [key]: chainVal
      }

      if (soul) previousSoul = soul
    }

    return this.put(graph, cb)
  }

  getPathSouls(path: string[]) {
    const promise = new Promise<string[]>(ok => {
      if (path.length === 1) {
        ok(path)
        return
      }

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
          end()
          ok(souls)
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
    })

    return promise
  }

  /**
   * Request node data
   *
   * @param soul identifier of node to request
   * @param cb callback for response messages
   * @param msgId optional unique message identifier
   * @returns a function to cleanup listeners when done
   */
  get(soul: string, cb?: GunMsgCb, msgId?: string) {
    const id = msgId || generateMessageId()

    this.events.get.trigger({
      soul,
      msgId: id,
      cb
    })

    return () => this.events.off.trigger(id)
  }

  /**
   * Write node data
   *
   * @param data one or more gun nodes keyed by soul
   * @param cb optional callback for response messages
   * @param msgId optional unique message identifier
   * @returns a function to clean up listeners when done
   */
  put(data: GunGraphData, cb?: GunMsgCb, msgId?: string) {
    let diff: GunGraphData | undefined = flattenGraphData(addMissingState(data))

    const id = msgId || generateMessageId()
    ;(async () => {
      for (let i = 0; i < this._writeMiddleware.length; i++) {
        if (!diff) return
        diff = await this._writeMiddleware[i](diff, this._graph)
      }
      if (!diff) return

      this.events.put.trigger({
        msgId: id,
        graph: diff,
        cb
      })

      this._receiveGraphData(diff)
    })()

    return () => this.events.off.trigger(id)
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
  private async _receiveGraphData(data?: GunGraphData, id?: string, replyToId?: string) {
    let diff = data

    for (let i = 0; i < this._readMiddleware.length; i++) {
      if (!diff) return
      diff = await this._readMiddleware[i](diff, this._graph)
    }

    if (!diff) return

    for (let soul in diff) {
      const node = this._nodes[soul]
      if (!node) continue
      node.receive(
        (this._graph[soul] = mergeGunNodes(
          this._graph[soul],
          diff[soul],
          this._opt.mutable ? 'mutable' : 'immutable'
        ))
      )
    }

    this.events.graphData.trigger(diff, id, replyToId)
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
