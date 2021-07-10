/**
 * Describes a user uniquely on the service.
 */
export class DSUser {
  /**
   * @param {string} id
   */
  constructor (id) {
    this._id = id
  }

  /**
   * @returns {string}
   */
  get id () {
    return this._id
  }
}
