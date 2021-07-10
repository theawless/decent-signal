/**
 * Store keys for users.
 * @interface
 */
export class DSKeystore {
  /**
   * Load key for a user.
   * @param {DSUser} of
   * @returns {Promise<DSKey | undefined>}
   */
  async load (of) {}

  /**
   * Save key for a user.
   * @param {DSUser} of
   * @param {DSKey} key
   */
  async save (of, key) {}

  /**
   * Remove key for a user.
   * @param {DSUser} of
   */
  async remove (of) {}
}
