/**
 * @event DSCommunicator#event:key-changed
 * @param {DSKey} key
 */

/**
 * Abstraction over various types of cryptographic communication strategies.
 * @interface
 * @implements DSEventsProvider
 */
export class DSCommunicator {
  /**
   * Build our key.
   * @returns {Promise<DSKey>} key
   */
  async buildKey () {}

  /**
   * Accept key from a user.
   * @param {DSUser} from
   * @param {DSKey} key
   */
  async acceptKey (from, key) {}

  /**
   * Remove key for a user.
   * @param {DSUser} of
   */
  async removeKey (of) {}

  /**
   * Encrypt plain message for a user.
   * @param {DSUser} to
   * @param {DSMessage} message
   */
  async encrypt (to, message) {}

  /**
   * Decrypt encrypted message for a user.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async decrypt (from, message) {}
}
