import { GunQueue } from './GunQueue'
import { MiddlewareSystem } from './MiddlewareSystem'
import { GunEvent } from './GunEvent'

export class GunProcessQueue<T = GunMsg, U = any, V = any> extends GunQueue<T> {
  middleware: MiddlewareSystem<T, U, V>
  isProcessing: boolean
  completed: GunEvent<T>

  constructor(name = 'GunProcessQueue') {
    super(name)
    this.isProcessing = false
    this.completed = new GunEvent<T>(`${name}._processed`)
    this.middleware = new MiddlewareSystem<T, U, V>(`${name}.middleware`)
  }

  async processNext(b?: U, c?: V) {
    let item = this.dequeue()
    if (!item) return item
    item = await this.middleware.process(item, b, c)
    if (item) this.completed.trigger(item)
  }

  async process() {
    if (this.isProcessing) return
    this.isProcessing = true
    while (this.count()) {
      try {
        await this.processNext()
      } catch (e) {
        console.error('Process Queue error', e.stack)
      }
    }
    this.isProcessing = false
  }
}
