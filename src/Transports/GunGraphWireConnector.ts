import { GunGraphConnector } from './GunGraphConnector'
import { generateMessageId } from '../Graph/GunGraphUtils'

export abstract class GunGraphWireConnector extends GunGraphConnector {
  private _callbacks: {
    [msgId: string]: GunMsgCb
  }

  constructor(name = 'GunWireProtocol') {
    super(name)
    this._callbacks = {}

    this._onProcessedInput = this._onProcessedInput.bind(this)
    this.inputQueue.completed.on(this._onProcessedInput)
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
    if (!graph) return () => {}
    const msg: GunMsg = {
      put: graph
    }
    if (msgId) msg['#'] = msgId
    if (replyTo) msg['@'] = replyTo

    return this.req(msg, cb)
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
    const get = { '#': soul }
    // if (key) get["."] = key
    const msg: GunMsg = { get }
    if (msgId) msg['#'] = msgId

    return this.req(msg, cb)
  }

  /**
   * Send a message that expects responses via @
   *
   * @param msg
   * @param cb
   */
  req(msg: GunMsg, cb?: GunMsgCb) {
    const reqId = (msg['#'] = msg['#'] || generateMessageId())
    if (cb) this._callbacks[reqId] = cb
    this.send([msg])
    return () => delete this._callbacks[reqId]
  }

  private _onProcessedInput(msg?: GunMsg) {
    if (!msg) return
    const replyTo = msg['@']

    if ('put' in msg) {
      if (msg.put) this.events.graphData.trigger(msg.put, replyTo)
    }

    if (replyTo) {
      const cb = this._callbacks[replyTo]
      if (cb) cb(msg)
    }
  }
}
