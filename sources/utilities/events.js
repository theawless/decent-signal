/**
 * Opinionated event emitter for common use.
 * TODO: Should find a library for this?
 */
export class DecentSignalEvents {
  /**
   * The handlers field is a map of event to list of handlers.
   */
  constructor () {
    this._handlers = new Map()
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
   * The args to handler will be same as the args passed while emitting the event.
   * @param {string} event
   * @param {function(...*): *} handler
   */
  connect (event, handler) {
    this._handlers.set(event, this._handlers.get(event) || [])
    this._handlers.get(event).push(handler)
  }

  /**
   * Disconnect to an event.
   * This should be the same handler that was passed in the connect method.
   * @param {string} event
   * @param {function(...*): void} handler
   */
  disconnect (event, handler) {
    const handlers = this._handlers.get(event).filter((h) => h !== handler)
    if (handlers.length > 0) {
      this._handlers.set(event, handlers)
    } else {
      this._handlers.delete(event)
    }
  }
}
