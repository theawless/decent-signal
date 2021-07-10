/**
 * Opinionated event emitter for common use.
 * @implements DSEvents
 */
export class DSEventEmitter {
  /**
   * Plain old constructor.
   */
  constructor () {
    this._handlers = new Map() // event to set of handlers
  }

  /**
   * Emit an event by calling all handlers sequentially.
   * @param {string} event
   * @param {...*} args
   */
  emit (event, ...args) {
    for (const handler of this._handlers.get(event) || []) {
      handler(...args)
    }
  }

  /**
   * Connect to an event.
   * Args to the handler will be same as those passed while emitting the event.
   * @param {string} event
   * @param {(...*) => void} handler
   */
  connect (event, handler) {
    if (this._handlers.has(event)) {
      const set = this._handlers.get(event)
      if (set.has(event)) {
        throw new Error(`handler is already connected to event ${event}`)
      } else {
        set.add(handler)
      }
    } else {
      const set = new Set().add(handler)
      this._handlers.set(event, set)
    }
  }

  /**
   * Disconnect from an event.
   * This should be the same handler that was passed in the connect method.
   * @param {string} event
   * @param {(...*) => void} handler
   */
  disconnect (event, handler) {
    if (this._handlers.has(event)) {
      const set = this._handlers.get(event)
      if (!set.delete(handler)) {
        throw new Error(`handler was not connected to event ${event}`)
      }
      if (set.size === 0) {
        this._handlers.delete(event)
      }
    } else {
      throw new Error(`no handlers connected to event ${event}`)
    }
  }
}
