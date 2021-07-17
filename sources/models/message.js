/**
 * Message on the channel.
 */
export class DSMessage {
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

  /**
   * @param {string} data
   */
  set data (data) {
    this._data = data
  }
}
