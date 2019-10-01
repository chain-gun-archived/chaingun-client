import { GunEvent } from '../ControlFlow/GunEvent'
import { GunProcessQueue } from '../ControlFlow/GunProcessQueue'
import { GunGraph } from '../Graph/GunGraph'

export abstract class GunGraphConnector {
  name: string
  isConnected: boolean

  events: {
    graphData: GunEvent<GunGraphData, string | undefined, string | undefined>
    receiveMessage: GunEvent<GunMsg>
    connection: GunEvent<boolean>
  }

  protected inputQueue: GunProcessQueue<GunMsg>
  protected outputQueue: GunProcessQueue<GunMsg>

  constructor(name = 'GunGraphConnector') {
    this.isConnected = false
    this.name = name

    this.put = this.put.bind(this)
    this.off = this.off.bind(this)

    this.inputQueue = new GunProcessQueue<GunMsg>(`${name}.inputQueue`)
    this.outputQueue = new GunProcessQueue<GunMsg>(`${name}.outputQueue`)

    this.events = {
      graphData: new GunEvent<GunGraphData>(`${name}.events.graphData`),
      receiveMessage: new GunEvent<GunMsg>(`${name}.events.receiveMessage`),
      connection: new GunEvent(`${name}.events.connection`)
    }

    this.__onConnectedChange = this.__onConnectedChange.bind(this)
    this.events.connection.on(this.__onConnectedChange)
  }

  connectToGraph(graph: GunGraph) {
    graph.events.off.on(this.off)
    return this
  }

  off(msgId: string) {
    return this
  }

  sendPutsFromGraph(graph: GunGraph) {
    graph.events.put.on(this.put)
  }

  sendRequestsFromGraph(graph: GunGraph) {
    graph.events.get.on(req => {
      this.get(req)
    })
  }

  waitForConnection() {
    if (this.isConnected) return Promise.resolve()
    return new Promise(ok => {
      const onConnected = (connected?: boolean) => {
        if (!connected) return
        ok()
        this.events.connection.off(onConnected)
      }
      this.events.connection.on(onConnected)
    })
  }

  /**
   * Send graph data for one or more nodes
   *
   * @returns A function to be called to clean up callback listeners
   */
  put({ graph, msgId = '', replyTo = '', cb }: ChainGunPut) {
    return () => {}
  }

  /**
   * Request data for a given soul
   *
   * @returns A function to be called to clean up callback listeners
   */
  get({
    soul,
    cb,
    msgId = '',
    key = '' // TODO
  }: ChainGunGet) {
    return () => {}
  }

  /**
   * Queues outgoing messages for sending
   *
   * @param msgs The Gun wire protocol messages to enqueue
   */
  send(msgs: GunMsg[]) {
    this.outputQueue.enqueueMany(msgs)
    if (this.isConnected) this.outputQueue.process()
  }

  /**
   * Queue incoming messages for processing
   *
   * @param msgs
   */
  ingest(msgs: GunMsg[]) {
    this.inputQueue.enqueueMany(msgs).process()
  }

  private __onConnectedChange(connected?: boolean) {
    if (connected) {
      this.isConnected = true
      this.outputQueue.process()
    } else {
      this.isConnected = false
    }
  }
}
