import { DecentSignalEvents } from '../utilities/events'

/**
 * Abstraction over a chat where the messages will be exchanged.
 *
 * The event "message-received" is emitted when there's a new message in the chat for us.
 */
export class DecentSignalChat {
  /**
   * Implementors can use the events field.
   */
  constructor () {
    this.events = new DecentSignalEvents()
  }

  /**
   * Join the chat.
   */
  async joinChat () {}

  /**
   * Leave the chat.
   */
  async leaveChat () {}

  /**
   * Send message to a user.
   * If to is undefined, it means the message is a broadcast.
   * @param {DecentSignalUser | undefined} to
   * @param {DecentSignalMessage} message
   */
  async sendMessage (to, message) {}
}
