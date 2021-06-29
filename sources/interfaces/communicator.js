import { DecentSignalEvents } from '../utilities/events'

/**
 * List of contacts that we can communicate to and how.
 * TODO: Is this a good name?
 *
 * The event "contact-info" is emitted when our contact information changes.
 */
export class DecentSignalCommunicator {
  /**
   * Implementors can use the events field.
   */
  constructor () {
    this.events = new DecentSignalEvents()
  }

  /**
   * Build our contact information.
   * @returns {DecentSignalContact}
   */
  async getContact () {}

  /**
   * Set contact for a user.
   * @param {DecentSignalUser} of
   * @param {DecentSignalContact} contact
   */
  async setContact (of, contact) {}

  /**
   * Remove contact of a user.
   * @param {DecentSignalUser} of
   */
  removeContact (of) {}

  /**
   * Encrypt plain text for a user.
   * @param {DecentSignalUser} to
   * @param {string} text
   * @returns {Promise<string>}
   */
  async encryptText (to, text) {}

  /**
   * Decrypt encrypted text for a user.
   * @param {DecentSignalUser} from
   * @param {string} text
   * @returns {Promise<string>}
   */
  async decryptText (from, text) {}
}
