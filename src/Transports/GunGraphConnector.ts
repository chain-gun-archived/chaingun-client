import { GunEvent } from '../ControlFlow/GunEvent'
import { GunProcessQueue } from '../ControlFlow/GunProcessQueue'

export abstract class GunGraphConnector {
  name: string
  isConnected: boolean

  events: {
    graphData: GunEvent<GunGraphData, string | undefined>
    receiveMessage: GunEvent<GunMsg>
    connection: GunEvent<boolean>
  }

  protected inputQueue: GunProcessQueue<GunMsg>
  protected outputQueue: GunProcessQueue<GunMsg>

  constructor(name = 'GunGraphConnector') {
    this.isConnected = false
    this.name = name

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

  /**
   * Send graph data for one or more nodes
   *
   * @returns A function to be called to clean up callback listeners
   */
  put({
    graph,
    msgId = '',
    replyTo = '',
    cb
  }: {
    graph: GunGraphData
    msgId?: string
    replyTo?: string
    cb?: GunMsgCb
  }) {
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
  }: {
    soul: string
    msgId?: string
    key?: string
    cb?: GunMsgCb
  }) {
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
