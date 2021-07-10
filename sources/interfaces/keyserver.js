/**
 * @event DSKeyserver#event:user-seen
 * @param {DSUser} user
 * @param {DSKey} key
 */

/**
 * @event DSKeyserver#event:user-left
 * @param {DSUser} user
 */

/**
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

  /**
   * Get all users in the server along with their keys.
   * @returns {Promise<Array<{user: DSUser, key: DSKey}>>}
   */
  async everyone () {}
}
