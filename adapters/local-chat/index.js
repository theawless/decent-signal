import { DecentSignalChannel, DecentSignalMessage, DecentSignalUser } from 'decent-signal'

/**
 * Add rank to the decent signal user description.
 */
export class DecentSignalLocalChatUser extends DecentSignalUser {
  constructor (id, rank) {
    super(id)
    this.rank = rank
  }
}

/**
 * Hacky implementation for a local chat using RxDB.
 */
export class DecentSignalLocalChat extends DecentSignalChannel {
  /**
   * Ideally we shouldn't store ranks in the messages.
   * The user information should be provided by the channel through other functionality.
   * @returns {object}
   */
  static get SCHEMA () {
    return {
      version: 0,
      properties: {
        from_id: { type: 'string' },
        from_rank: { type: 'number' },
        to_id: { type: 'string' },
        to_rank: { type: 'number' },
        party: { type: 'string' },
        type: { type: 'string' },
        message: { type: 'string' }
      }
    }
  };

  /**
   * @param {RxDatabaseBase} db
   * @param {DecentSignalLocalChatUser} user
   */
  constructor (db, user) {
    super()
    this._db = db
    this._user = user
    this._onCollectionChange = (change) => this._handleMessage(change.documentData)
  }

  /**
   * Start listening to all message insertion events.
   * @returns {Promise<void>}
   */
  async startListening () {
    await this._db.collection({ name: 'messages', schema: DecentSignalLocalChat.SCHEMA })
    this._db.messages.insert$.subscribe(this._onCollectionChange)
  }

  /**
   * Handle the incoming message.
   * @param {object} entry
   */
  _handleMessage (entry) {
    const from = new DecentSignalLocalChatUser(entry.from_id, entry.from_rank)
    const to = entry.to_id === '' ? undefined : new DecentSignalLocalChatUser(entry.to_id, entry.to_rank)
    const message = new DecentSignalMessage(entry.party, to, entry.type, entry.message)
    this.events.emit('message-received', from, message)
  }

  /**
   * Stop listening to updates in the database.
   * @returns {Promise<void>}
   */
  async stopListening () {
    await this._db.messages.destroy()
  }

  /**
   * Send message to the channel.
   * @param {DecentSignalMessage} message
   * @returns {Promise<void>}
   */
  async sendMessage (message) {
    const doc = {
      from_id: this._user.id,
      from_rank: this._user.rank,
      to_id: message.to === undefined ? '' : message.to.id,
      to_rank: message.to === undefined ? -1 : message.to.rank,
      party: message.party,
      type: message.type,
      message: message.message
    }
    await this._db.messages.insert(doc)
  }
}
