import { DSEventEmitter } from './utilities/events'

/**
 * @event DSCommunicator#event:user-join
 * @param {DSUser} user
 * @param {() => Promise<void>} connect
 */

/**
 * @event DSCommunicator#event:user-seen
 * @param {DSUser} user
 * @param {() => Promise<void>} connect
 */

/**
 * @event DSCommunicator#event:user-left
 * @param {DSUser} user
 */

/**
 * @event DSCommunicator#event:message-received
 * @param {DSUser} user
 * @param {DSMessage} message
 */

/**
 * Cryptographically secure communication.
 * @implements DSEventsProvider
 */
export class DSCommunicator {
  /**
   * @param {DSService} service
   * @param {DSCryptoSystem} system
   */
  constructor (service, system) {
    this._emitter = new DSEventEmitter()
    this._service = service
    this._system = system
    this._users = new Map() // user id to user
    this._onUserJoin = (...args) => this._handleFound('join', ...args).then()
    this._onUserSeen = (...args) => this._handleFound('seen', ...args).then()
    this._onUserReset = (...args) => this._handleFound('reset', ...args).then()
    this._onUserLeft = (user) => this._handleLeft(user).then()
    this._onMessageReceived = (...args) => this._handleMessage(...args).then()
    this._onKeyChanged = (key) => this._handleKey(key).then()
  }

  get events () {
    return this._emitter
  }

  /**
   * Start the communication.
   */
  async start () {
    const key = await this._system.buildKey()
    this._service.events.on('user-join', this._onUserJoin)
    this._service.events.on('user-seen', this._onUserSeen)
    this._service.events.on('user-reset', this._onUserReset)
    this._service.events.on('user-left', this._onUserLeft)
    this._service.events.on('message-received', this._onMessageReceived)
    this._system.events.on('key-changed', this._onKeyChanged)
    await this._service.join(key)
  }

  /**
   * Stop the communication.
   */
  async stop () {
    this._service.events.off('user-join', this._onUserJoin)
    this._service.events.off('user-seen', this._onUserSeen)
    this._service.events.off('user-reset', this._onUserReset)
    this._service.events.off('user-left', this._onUserLeft)
    this._service.events.off('message-received', this._onMessageReceived)
    this._system.events.off('key-changed', this._onKeyChanged)
    await this._service.leave()
  }

  /**
   * Connect to a user on the service.
   * @param {DSUser} to
   * @param {DSKey} key
   */
  async _connect (to, key) {
    try {
      await this._system.acceptKey(to, key)
      this._users.set(to.id, to)
    } catch (e) {
      console.error(e)
      throw new Error(`unable to connect with user ${to.id}`)
    }
  }

  /**
   * Disconnect from a connected user.
   * @param {DSUser} from
   */
  async _disconnect (from) {
    if (this._users.delete(from.id)) {
      await this._system.removeKey(from)
    } else {
      throw new Error(`user ${from.id} was not connected`)
    }
  }

  /**
   * Send message after encrypting it for the user.
   * @param {DSUser} to
   * @param {DSMessage} message
   */
  async send (to, message) {
    if (!this._users.has(to.id)) {
      throw new Error(`cannot send message to unconnected user ${to.id}`)
    }
    try {
      await this._system.encrypt(to, message)
      await this._service.send(message, to)
    } catch (e) {
      console.error(e)
      throw new Error(`unable to send message to user ${to.id}`)
    }
  }

  /**
   * Submit key to service if our crypto system generates new one.
   * @param {DSKey} key
   */
  async _handleKey (key) {
    await this._service.submit(key)
  }

  /**
   * Emit user updates and ask clients to connect or not.
   * @param {string} action
   * @param {DSUser} user
   * @param {DSKey} key
   */
  async _handleFound (action, user, key) {
    if (this._users.has(user.id)) {
      await this._disconnect(user)
    }
    if (action === 'join' || action === 'seen') {
      const connect = async () => await this._connect(user, key)
      this._emitter.emit(`user-${action}`, user, connect)
    } else if (action === 'reset') {
      await this._connect(user, key)
    }
  }

  /**
   * Emit user update and clear our state.
   * @param {DSUser} user
   */
  async _handleLeft (user) {
    if (this._users.has(user.id)) {
      await this._disconnect(user)
      this._emitter.emit('user-left', user)
    }
  }

  /**
   * Emit message after decrypting it.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async _handleMessage (from, message) {
    if (!this._users.has(from.id)) {
      console.log(`Unconnected user ${from.id} trying to send us a message.`)
      return
    }
    try {
      await this._system.decrypt(from, message)
      this._emitter.emit('message-received', from, message)
    } catch (e) {
      console.error(e)
      throw new Error(`unable to receive message from user ${from.id}`)
    }
  }
}
