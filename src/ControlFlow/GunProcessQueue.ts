import { GunMsg } from '@chaingun/types'
import { GunEvent } from './GunEvent'
import { GunQueue } from './GunQueue'
import { MiddlewareSystem } from './MiddlewareSystem'

export class GunProcessQueue<T = GunMsg, U = any, V = any> extends GunQueue<T> {
  public readonly middleware: MiddlewareSystem<T, U, V>
  public readonly isProcessing: boolean
  public readonly completed: GunEvent<T>

  constructor(name = 'GunProcessQueue') {
    super(name)
    this.isProcessing = false
    this.completed = new GunEvent<T>(`${name}._processed`)
    this.middleware = new MiddlewareSystem<T, U, V>(`${name}.middleware`)
  }

  public async processNext(b?: U, c?: V): Promise<void> {
    // tslint:disable-next-line: no-let
    let item = this.dequeue()
    if (!item) {
      return
    }
    item = await this.middleware.process(item, b, c)
    if (item) {
      this.completed.trigger(item)
    }
  }

  public enqueueMany(items: readonly T[]): GunProcessQueue<T, U, V> {
    super.enqueueMany(items)
    return this
  }

  public async process(): Promise<void> {
    if (this.isProcessing) {
      return
    }

    // @ts-ignore
    this.isProcessing = true
    while (this.count()) {
      try {
        await this.processNext()
      } catch (e) {
        // tslint:disable-next-line: no-console
        console.error('Process Queue error', e.stack)
      }
    }

    // @ts-ignore
    this.isProcessing = false
  }
}
