/**
 * Describes a user on the server.
 */
export class DecentSignalUser {
  /**
   * User id should be unique on the server.
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

/**
 * Describes contact information for a user.
 */
export class DecentSignalContact {
  /**
   * @param {string} info
   */
  constructor (info) {
    this._info = info
  }

  /**
   * @returns {string}
   */
  get info () {
    return this._info
  }
}

/**
 * Describes a message on the chat.
 */
export class DecentSignalMessage {
  /**
   * @param {string} text
   */
  constructor (text) {
    this._text = text
  }

  /**
   * @returns {string}
   */
  get text () {
    return this._text
  }

  /**
   * @param {string} text
   */
  set text (text) {
    this._text = text
  }
}
