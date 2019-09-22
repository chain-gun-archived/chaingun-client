export class MiddlewareSystem<T, U = undefined, V = undefined> {
  name: string
  private _middlewareFunctions: ((a: T, b?: U, c?: V) => T | undefined)[]

  constructor(name = 'MiddlewareSystem') {
    this.name = name
    this._middlewareFunctions = []
  }

  /**
   * Register middleware function
   *
   * @param middleware The middleware function to add
   */
  use(middleware: (a: T, b?: U, c?: V) => T | undefined) {
    if (this._middlewareFunctions.indexOf(middleware) !== -1) return
    this._middlewareFunctions.push(middleware)
    return this
  }

  /**
   * Unregister middleware function
   *
   * @param middleware The middleware function to remove
   */
  unuse(middleware: (a: T, b?: U, c?: V) => T | undefined) {
    const idx = this._middlewareFunctions.indexOf(middleware)
    if (idx !== -1) this._middlewareFunctions.splice(idx, 1)
    return this
  }

  /**
   * Process values through this middleware
   * @param a Required, this is the value modified/passed through each middleware fn
   * @param b Optional extra argument passed to each middleware function
   * @param c Optional extra argument passed to each middleware function
   */
  async process(a: T, b?: U, c?: V) {
    let val: T | undefined = a

    for (let i = 0; i < this._middlewareFunctions.length; i++) {
      if (!val) return
      val = await this._middlewareFunctions[i](val, b, c)
    }

    return val
  }
}
