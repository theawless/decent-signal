import { DSKey } from '../../models/key'
import { DSMessage } from '../../models/message'
import { DSUser } from '../../models/user'
import { DSEventEmitter } from '../../utilities/event-emitter'

/**
 * @event DSSyncedRxDBService#event:user-seen
 * @param {DSUser} user
 * @param {DSKey} key
 */

/**
 * @event DSSyncedRxDBService#event:user-left
 * @param {DSUser} user
 */

/**
 * @event DSSyncedRxDBService#event:user-reset
 * @param {DSUser} user
 * @param {DSKey} key
 */

/**
 * @event DSSyncedRxDBService#event:message-received
 * @param {DSUser} from
 * @param {DSMessage} message
 */

/**
 * Hacky implementation for a service using RxDB.
 * @implements DSService
 */
export class DSSyncedRxDBService {
  /**
   * The db should be fully constructed.
   * @param {RxDatabaseBase} db
   * @param {DSUser} user
   */
  constructor (db, user) {
    this._emitter = new DSEventEmitter()
    this._db = db
    this._user = user
    this._onUserInserted = (change) => this._handleUser(change.documentData, 'seen')
    this._onUserRemoved = (change) => this._handleUser(change.documentData, 'left')
    this._onUserUpdated = (change) => this._handleUser(change.documentData, 'reset')
    this._onMessageInserted = (change) => this._handleMessage(change.documentData)
  }

  /**
   * @returns {object}
   */
  static get _USERS_SCHEMA () {
    return {
      version: 0,
      properties: {
        id: { type: 'string', primary: true },
        key: { type: 'string' }
      }
    }
  };

  /**
   * @returns {object}
   */
  static get _MESSAGES_SCHEMA () {
    return {
      version: 0,
      properties: {
        from_id: { type: 'string' },
        to_id: { type: 'string' },
        message: { type: 'string' }
      }
    }
  };

  /**
   * @returns {DSEvents}
   */
  get events () {
    return this._emitter
  }

  /**
   * Start listening to db updates.
   * @param {DSKey} key
   */
  async join (key) {
    await this._db.addCollections({
      users: { schema: DSSyncedRxDBService._USERS_SCHEMA },
      messages: { schema: DSSyncedRxDBService._MESSAGES_SCHEMA }
    })
    this._db.users.insert$.subscribe(this._onUserInserted)
    this._db.users.remove$.subscribe(this._onUserRemoved)
    this._db.users.update$.subscribe(this._onUserUpdated)
    this._db.messages.insert$.subscribe(this._onMessageInserted)
    await this._clearOld()
    await this.submit(key)
  }

  /**
   * Stop listening to db updates.
   */
  async leave () {
    await this._clearOld()
    await Promise.all([
      this._db.messages.destroy(),
      this._db.users.destroy()
    ])
  }

  /**
   * Submit our key in the db.
   * @param {DSKey} key
   */
  async submit (key) {
    const doc = { id: this._user.id, key: key.data }
    await this._db.users.upsert(doc)
  }

  /**
   * Obtain key for a user by querying.
   * @param {DSUser} of
   * @returns {Promise<DSKey | undefined>}
   */
  async obtain (of) {
    const doc = await this._db.users.findOne().where('id').eq(of.id).exec()
    return new DSKey(doc.key)
  }

  /**
   * Get all users in the db along with their keys.
   * @returns {Promise<Array<{user: DSUser, key: DSKey}>>}
   */
  async everyone () {
    const docs = await this._db.users.find().exec()
    const array = []
    for (const doc of docs) {
      if (doc.id === this._user.id) {
        continue
      }
      const user = new DSUser(doc.id)
      const key = new DSKey(doc.key)
      array.push({ user, key })
    }
    return array
  }

  /**
   * Send message by inserting it.
   * @param {DSMessage} message
   * @param {DSUser} [to]
   */
  async send (message, to) {
    const doc = {
      from_id: this._user.id,
      to_id: to ? to.id : '',
      message: message.data
    }
    await this._db.messages.insert(doc)
  }

  /**
   * Clear our old user entry.
   */
  async _clearOld () {
    const query = this._db.users.findOne().where('id').eq(this._user.id)
    const doc = await query.exec()
    if (doc) {
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
    const from = new DSUser(entry.id)
    const key = new DSKey(entry.key)
    this._emitter.emit(`user-${action}`, from, key)
  }

  /**
   * Handle the incoming message.
   * @param {object} entry
   */
  _handleMessage (entry) {
    if (entry.from_id === this._user.id) {
      return
    }
    if (entry.to_id !== '' && entry.to_id !== this._user.id) {
      return
    }
    const from = new DSUser(entry.from_id)
    const message = new DSMessage(entry.message)
    this._emitter.emit('message-received', from, message)
  }
}
