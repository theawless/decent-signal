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
