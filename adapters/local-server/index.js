import { DecentSignalContact, DecentSignalEvents, DecentSignalServer, DecentSignalUser } from 'decent-signal'
import { DecentSignalLocalChat } from 'decent-signal-local-chat'

/**
 * Hacky implementation for a local server using RxDB.
 */
export class DecentSignalLocalServer extends DecentSignalServer {
  /**
   * The db should be fully constructed.
   * @param {RxDatabaseBase} db
   * @param {DecentSignalUser} user
   */
  constructor (db, user) {
    super()
    this.events = new DecentSignalEvents()
    this._db = db
    this._user = user
    this._chat = new DecentSignalLocalChat(db, user)
    this._onEntryInserted = (change) => this._handleUser(change.documentData, 'seen')
    this._onEntryRemoved = (change) => this._handleUser(change.documentData, 'left')
    this._onEntryUpdated = (change) => this._handleUser(change.documentData, 'reset')
    this._onMessageReceived = (from, message) => this.events.emit('message-received', from, message)
  }

  /**
   * @returns {object}
   */
  static get _SCHEMA () {
    return {
      version: 0,
      properties: {
        id: { type: 'string', primary: true },
        contact: { type: 'string' }
      }
    }
  };

  /**
   * Set our contact info in the existing document.
   * @param {DecentSignalContact} contact
   */
  async setContact (contact) {
    const doc = {
      id: this._user.id,
      contact: contact.info
    }
    await this._db.users.upsert(doc)
  }

  /**
   * Get contact info from the collection.
   * @param {DecentSignalUser} of
   * @returns {Promise<DecentSignalContact | undefined>}
   */
  async getContact (of) {
    const doc = await this._db.users.findOne().where('id').eq(of.id).exec()
    return new DecentSignalContact(doc.contact)
  }

  /**
   * Get users in the collection.
   * @returns {Promise<DecentSignalUser[]>}
   */
  async getUsers () {
    const docs = await this._db.users.find().exec()
    return docs.filter(doc => doc.id !== this._user.id).map(doc => new DecentSignalUser(doc.id))
  }

  /**
   * Start listening to all user update events.
   */
  async joinServer (contact) {
    await this._db.collection({ name: 'users', schema: DecentSignalLocalServer._SCHEMA })
    this._db.users.insert$.subscribe(this._onEntryInserted)
    this._db.users.remove$.subscribe(this._onEntryRemoved)
    this._db.users.update$.subscribe(this._onEntryUpdated)
    await this._chat.joinChat()
    this._chat.events.connect('message-received', this._onMessageReceived)
    await this._clearOld()
    await this.setContact(contact)
  }

  /**
   * Stop listening to updates in the collection.
   */
  async leaveServer () {
    this._chat.events.disconnect('message-received', this._onMessageReceived)
    await this._chat.leaveChat()
    await this._clearOld()
    await this._db.users.destroy()
  }

  /**
   * Send message by using local chat.
   * @param {DecentSignalUser | undefined} to
   * @param {DecentSignalMessage} message
   */
  async sendMessage (to, message) {
    await this._chat.sendMessage(to, message)
  }

  /**
   * Clear our old user entry.
   */
  async _clearOld () {
    const doc = await this._db.users.findOne().where('id').eq(this._user.id).exec()
    if (doc !== undefined) {
      doc.remove()
    }
  }

  /**
   * Handle the user update.
   * @param {object} entry
   * @param {string} action
   */
  _handleUser (entry, action) {
    if (entry.id === this._user.id) {
      return
    }
    const from = new DecentSignalUser(entry.id)
    this.events.emit(`user-${action}`, from)
  }
}
