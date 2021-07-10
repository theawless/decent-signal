/**
 * @event DSChannel#event:message-received
 * @param {DSUser} from
 * @param {DSMessage} message
 */

/**
 * Abstraction over a channel where messages will be exchanged.
 * @interface
 * @augments DSEventsProvider
 */
export class DSChannel {
  /**
   * Join the channel.
   */
  async join () {}

  /**
   * Leave the channel.
   */
  async leave () {}

  /**
   * Send message to the channel.
   * Message is considered to be a broadcast if to is not provided.
   * @param {DSMessage} message
   * @param {DSUser} [to]
   */
  async send (message, to) {}
}
