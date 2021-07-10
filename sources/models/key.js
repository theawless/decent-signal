/**
 * Cryptographic key for a user.
 */
export class DSKey {
  /**
   * @param {string} data
   */
  constructor (data) {
    this._data = data
  }

  /**
   * @returns {string}
   */
  get data () {
    return this._data
  }
}
