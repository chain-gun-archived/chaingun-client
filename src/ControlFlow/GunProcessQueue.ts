import { GunQueue } from './GunQueue'
import { MiddlewareSystem } from './MiddlewareSystem'
import { GunEvent } from './GunEvent'

export class GunProcessQueue<T = GunMsg, U = any, V = any> extends GunQueue<T> {
  middleware: MiddlewareSystem<T, U, V>

  completed: GunEvent<T>

  constructor(name = 'GunProcessQueue') {
    super(name)
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
    while (this.count()) {
      await this.processNext()
    }
  }
}
