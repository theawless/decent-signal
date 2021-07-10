/**
 * Events that can be connected to.
 * @interface
 */
export class DSEvents {
  /**
   * Connect to an event.
   * @param {string} event
   * @param {(...*) => void} handler
   */
  connect (event, handler) {}

  /**
   * Disconnect from an event.
   * @param {string} event
   * @param {(...*) => void} handler
   */
  disconnect (event, handler) {}
}
