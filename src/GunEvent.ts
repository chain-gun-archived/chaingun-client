type EventCb<T = any, U = any, V = any> = (a?: T, b?: U, c?: V) => void

export class GunEvent<T = any, U = any, V = any> {
  name: string
  private _listeners: EventCb<T, U, V>[]

  constructor(name = 'GunEvent') {
    this.name = name
    this._listeners = []
    this.listenerCount = this.listenerCount.bind(this)
    this.on = this.on.bind(this)
    this.off = this.off.bind(this)
    this.trigger = this.trigger.bind(this)
  }

  listenerCount() {
    return this._listeners.length
  }

  on(cb: EventCb<T, U, V>) {
    this._listeners.push(cb)
  }

  off(cb: EventCb<T, U, V>) {
    const idx = this._listeners.indexOf(cb)
    if (idx !== -1) this._listeners.splice(idx, 1)
  }

  reset() {
    this._listeners = []
  }

  trigger(a?: T, b?: U, c?: V) {
    this._listeners.forEach(cb => cb(a, b, c))
  }
}
