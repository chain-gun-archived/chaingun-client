import { GunGraphConnector } from './GunGraphConnector'
import { generateMessageId } from './generateMessageId'

export class GunJsGraphConnector extends GunGraphConnector {
  private _gun: any
  private _requests: { [msgId: string]: string }
  private _requestsBySoul: { [soul: string]: string }

  constructor(gun: any) {
    super()
    this._gun = gun
    this._requests = {}
    this._requestsBySoul = {}

    const connector = this

    this._gun.on('put', function(this: any, request: GunMsg) {
      this.to.next(request)
      if (!request) return
      const respondingTo = request['@']
      const requestedSoul = respondingTo && connector._requests[respondingTo]

      if (request.put) {
        connector.graphData.trigger(request.put)
      } else if (requestedSoul) {
        connector.graphData.trigger({
          [requestedSoul]: undefined
        })
      }
    })
  }

  request(souls: string[]) {
    for (let i = 0; i < souls.length; i++) {
      const soul = souls[i]
      if (soul in this._requestsBySoul) continue
      const msgId = generateMessageId()

      this._requests[msgId] = soul
      this._requestsBySoul[soul] = msgId
      this._gun.on('in', {
        '#': msgId,
        get: {
          '#': soul
        }
      })
    }
  }
}
