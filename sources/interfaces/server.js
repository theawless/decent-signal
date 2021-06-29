import { DecentSignalEvents } from '../utilities/events'

/**
 * Abstraction over a server where the messages and contact information will be exchanged.
 *
 * The event "user-seen" is emitted when there's a new user on the server.
 * The event "user-left" is emitted when a user leaves the server.
 * The event "user-reset" is emitted when a user resets their contact information.
 * The event "message-received" is emitted when there's new message on the server for us.
 */
export class DecentSignalServer {
  /**
   * Implementors can use the events field.
   */
  constructor () {
    this.events = new DecentSignalEvents()
  }

  /**
   * Set our contact info.
   * @param {DecentSignalContact} contact
   */
  async setContact (contact) {}

  /**
   * Get contact info for a user.
   * @param {DecentSignalUser} of
   * @returns {Promise<DecentSignalContact | undefined>}
   */
  async getContact (of) {}

  /**
   * Get users in the server.
   * @returns {Promise<DecentSignalUser[]>}
   */
  async getUsers () {}

  /**
   * Join the server.
   * @param {DecentSignalContact} contact
   */
  async joinServer (contact) {}

  /**
   * Leave the server.
   */
  async leaveServer () {}

  /**
   * Send message to a user.
   * If to is undefined, it means the message is a broadcast.
   * @param {DecentSignalUser | undefined} to
   * @param {DecentSignalMessage} message
   */
  async sendMessage (to, message) {}
}
