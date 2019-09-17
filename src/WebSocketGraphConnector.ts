import { GunGraphConnector } from './GunGraphConnector'
import { generateMessageId } from './generateMessageId'

const PING = 60000

export class WebSocketGraphConnector extends GunGraphConnector {
  url: string
  private _ws: WebSocket
  private _requests: { [msgId: string]: string }
  private _requestsBySoul: { [soul: string]: string }

  constructor(url: string, WS = WebSocket) {
    super()
    this.url = url
    this._requests = {}
    this._requestsBySoul = {}
    this._ws = new WS(this.url.replace(/^http/, 'ws'))
    this._ws.addEventListener('message', this.receiveSocketData.bind(this))
  }

  onSocketConnect(ws: WebSocket) {
    setInterval(() => ws.send('[]'), PING)
  }

  request(souls: string[]) {
    const msgs: GunMsg[] = []

    for (let i = 0; i < souls.length; i++) {
      const soul = souls[i]
      if (soul in this._requestsBySoul) continue
      const msgId = generateMessageId()

      this._requests[msgId] = soul
      this._requestsBySoul[soul] = msgId
      msgs.push({
        '#': msgId,
        get: {
          '#': soul
        }
      })
    }

    if (msgs.length === 1) {
      this._ws.send(JSON.stringify(msgs[0]))
    } else if (msgs.length > 0) {
      this._ws.send(JSON.stringify(msgs))
    }
  }

  receiveMessage(msg: GunMsg) {
    if (!msg) return
    if (!('put' in msg)) return
    const respondingTo = msg['@']
    const requestedSoul = respondingTo && this._requests[respondingTo]

    if (msg.put) {
      this.graphData.trigger(msg.put)
    } else if (requestedSoul) {
      this.graphData.trigger({
        [requestedSoul]: undefined
      })
    }
  }

  receiveSocketData(msg: any) {
    const raw = msg.data || msg
    const json = JSON.parse(raw)
    if (Array.isArray(json)) {
      json.forEach(this.receiveMessage.bind(this))
    } else {
      this.receiveMessage(json)
    }
  }
}
