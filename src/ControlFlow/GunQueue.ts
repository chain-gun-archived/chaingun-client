import { GunMsg } from '@chaingun/types'

export class GunQueue<T = GunMsg> {
  public readonly name: string
  // tslint:disable-next-line: readonly-keyword readonly-array
  private _queue: T[]

  constructor(name = 'GunQueue') {
    this.name = name
    this._queue = []
  }

  public count(): number {
    return this._queue.length
  }

  public enqueue(item: T): GunQueue<T> {
    if (this._queue.indexOf(item) !== -1) {
      return this
    }

    this._queue.splice(0, 0, item)
    return this
  }

  public dequeue(): T | undefined {
    return this._queue.pop()
  }

  public enqueueMany(items: readonly T[]): GunQueue<T> {
    this._queue.splice(0, 0, ...items.slice().reverse())
    return this
  }
}
