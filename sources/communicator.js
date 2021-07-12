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
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
    this._onUserJoin = (user, key) => this._handleUser(user, 'join', key).then()
    this._onUserSeen = (user, key) => this._handleUser(user, 'seen', key).then()
    this._onUserLeft = (user) => this._handleUser(user, 'left').then()
    this._onUserReset = (user, key) => this._handleUser(user, 'reset', key).then()
    this._onKeyChanged = (key) => this._handleKey(key).then()
  }

  /**
   * @returns {DSEvents}
   */
  get events () {
    return this._emitter
  }

  /**
   * Start the communication.
   */
  async start () {
    const key = await this._system.buildKey()
    await this._service.join(key)
    this._service.events.connect('message-received', this._onMessageReceived)
    this._service.events.connect('user-join', this._onUserJoin)
    this._service.events.connect('user-seen', this._onUserSeen)
    this._service.events.connect('user-reset', this._onUserReset)
    this._service.events.connect('user-left', this._onUserLeft)
    this._system.events.connect('key-changed', this._onKeyChanged)
  }

  /**
   * Stop the communication.
   */
  async stop () {
    this._system.events.disconnect('key-changed', this._onKeyChanged)
    this._service.events.disconnect('user-left', this._onUserLeft)
    this._service.events.disconnect('user-reset', this._onUserReset)
    this._service.events.disconnect('user-seen', this._onUserSeen)
    this._service.events.disconnect('user-join', this._onUserJoin)
    this._service.events.disconnect('message-received', this._onMessageReceived)
    await this._service.leave()
  }

  /**
   * Connect to a user on the service.
   * Key is fetched from the service if not provided.
   * @param {DSUser} to
   * @param {DSKey} [key]
   */
  async connect (to, key) {
    if (!key) {
      key = await this._service.obtain(to)
    }
    if (!key) {
      throw new Error('user not present on the service')
    }
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
  async disconnect (from) {
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
   * Handler for key changed event from the crypto system.
   * @param {DSKey} key
   */
  async _handleKey (key) {
    await this._service.submit(key)
  }

  /**
   * Handler for user updates on the service.
   * @param {DSUser} user
   * @param {string} action
   * @param {DSKey} [key]
   */
  async _handleUser (user, action, key) {
    if (action === 'join' || action === 'seen') {
      if (this._users.has(user.id)) {
        await this.disconnect(user)
      }
      const connect = async () => await this.connect(user, key)
      this._emitter.emit(`user-${action}`, user, connect)
    } else if (action === 'reset') {
      if (this._users.has(user.id)) {
        await this.disconnect(user)
        await this.connect(user, key)
      }
    } else if (action === 'left') {
      if (this._users.has(user.id)) {
        await this.disconnect(user)
        this._emitter.emit('user-left', user)
      }
    }
  }

  /**
   * Handler for incoming messages on the service.
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
