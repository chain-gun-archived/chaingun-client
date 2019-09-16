import { ChainGun } from './ChainGun'
import { generateMessageId } from './generateMessageId'

export function attachToGun(gunDb: any, chain: ChainGun) {
  const requests = {} as { [msgId: string]: string }
  const requestsBySoul = {} as { [soul: string]: string }

  function askNodes(souls: string[]) {
    for (let i = 0; i < souls.length; i++) {
      const soul = souls[i]
      if (soul in requestsBySoul) continue
      const msgId = generateMessageId()

      requests[msgId] = soul
      requestsBySoul[soul] = msgId
      gunDb.on('in', {
        '#': msgId,
        get: {
          '#': soul
        }
      })
    }
  }

  gunDb.on('put', function(this: any, request: GunMsg) {
    this.to.next(request)
    if (!request) return
    const respondingTo = request['@']
    const requestedSoul = respondingTo && requests[respondingTo]

    if (request.put) {
      chain.addNodeData(request.put)
    } else if (requestedSoul) {
      chain.addNodeData({
        [requestedSoul]: undefined
      })
    }
  })

  chain.opt({ askNodes })
  gunDb.chaingun = chain
  return gunDb
}
