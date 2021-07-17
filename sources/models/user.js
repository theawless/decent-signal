/**
 * User on the service.
 */
export class DSUser {
  /**
   * The id should be unique.
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
