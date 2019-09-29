export class GunQueue<T = GunMsg> {
  name: string
  private _queue: T[]

  constructor(name = 'GunQueue') {
    this.name = name
    this._queue = []
  }

  count() {
    return this._queue.length
  }

  enqueue(item: T) {
    if (this._queue.indexOf(item) !== -1) return this
    this._queue.splice(0, 0, item)
    return this
  }

  dequeue() {
    return this._queue.pop()
  }

  enqueueMany(items: T[]) {
    this._queue.splice(0, 0, ...items.slice().reverse())
    return this
  }
}
