/**
 * Events that can be listened to.
 * @interface
 */
export class DSEvents {
  /**
   * Listen to an event.
   * @param {string} event
   * @param {(...*) => void} handler
   */
  on (event, handler) {}

  /**
   * Stop listening to an event.
   * @param {string} event
   * @param {(...*) => void} handler
   */
  off (event, handler) {}
}

/**
 * Any object that emits events should implement this.
 * @interface
 */
export class DSEventsProvider {
  /**
   * @returns {DSEvents}
   */
  get events () {}
}

/**
 * Opinionated event emitter for common use.
 * @implements DSEvents
 */
export class DSEventEmitter {
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
   * Args to the handler will be same as those passed while emitting the event.
   */
  on (event, handler) {
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
   * This must be the same handler that was given while listening to the event.
   */
  off (event, handler) {
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
