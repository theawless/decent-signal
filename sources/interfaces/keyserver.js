/**
 * Emitted when we see a user who has just joined.
 * @event DSKeyserver#event:user-join
 * @param {DSUser} user
 * @param {DSKey} key
 */

/**
 * Emitted when we see the users who joined before us.
 * @event DSKeyserver#event:user-seen
 * @param {DSUser} user
 * @param {DSKey} key
 */

/**
 * Emitted when a user leaves.
 * @event DSKeyserver#event:user-left
 * @param {DSUser} user
 */

/**
 * Emitted when a user has reset their key.
 * @event DSKeyserver#event:user-reset
 * @param {DSUser} user
 * @param {DSKey} key
 */

/**
 * Abstraction over a server where keys are maintained.
 * @interface
 * @augments DSEventsProvider
 */
export class DSKeyserver {
  /**
   * Join the server.
   * @param {DSKey} key
   */
  async join (key) {}

  /**
   * Leave the server.
   */
  async leave () {}

  /**
   * Submit our key.
   * @param {DSKey} key
   */
  async submit (key) {}

  /**
   * Obtain key for a user.
   * @param {DSUser} of
   * @returns {Promise<DSKey | undefined>}
   */
  async obtain (of) {}
}
