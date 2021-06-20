import { DecentSignalChat, DecentSignalMessage, DecentSignalUser } from 'decent-signal'

/**
 * Hacky implementation for a local chat using RxDB.
 */
export class DecentSignalLocalChat extends DecentSignalChat {
  /**
   * The db should be fully constructed.
   * @param {RxDatabaseBase} db
   * @param {DecentSignalUser} user
   */
  constructor (db, user) {
    super()
    this._db = db
    this._user = user
    this._onCollectionChanged = (change) => this._handleMessage(change.documentData)
  }

  /**
   * @returns {object}
   */
  static get SCHEMA () {
    return {
      version: 0,
      properties: {
        from_id: { type: 'string' },
        to_id: { type: 'string' },
        text: { type: 'string' }
      }
    }
  };

  /**
   * Start listening to all message insertion events.
   */
  async joinChat () {
    await this._db.collection({ name: 'messages', schema: DecentSignalLocalChat.SCHEMA })
    this._db.messages.insert$.subscribe(this._onCollectionChanged)
  }

  /**
   * Stop listening to updates in the collection.
   */
  async leaveChat () {
    await this._db.messages.destroy()
  }

  /**
   * Send message by adding it to the collection.
   * @param {DecentSignalUser | undefined} to
   * @param {DecentSignalMessage} message
   */
  async sendMessage (to, message) {
    const doc = {
      from_id: this._user.id,
      to_id: to ? to.id : '',
      text: message.text
    }
    await this._db.messages.insert(doc)
  }

  /**
   * Handle the incoming message.
   * @param {object} entry
   */
  _handleMessage (entry) {
    const from = new DecentSignalUser(entry.from_id)
    const message = new DecentSignalMessage(entry.text)
    if (entry.from_id === this._user.id) {
      return
    }
    if (entry.to_id !== '' && entry.to_id !== this._user.id) {
      return
    }
    this.events.emit('message-received', from, message)
  }
}
