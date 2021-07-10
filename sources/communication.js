import { DSEventEmitter } from './utilities/event-emitter'

/**
 * @event DSSecureCommunication#event:user-seen
 * @param {DSUser} user
 * @param {() => Promise<void>} connect
 */

/**
 * @event DSSecureCommunication#event:user-left
 * @param {DSUser} user
 */

/**
 * @event DSSecureCommunication#event:message-received
 * @param {DSUser} user
 * @param {DSMessage} message
 */

/**
 * Cryptographically secure communication.
 * @implements DSEventsProvider
 */
export class DSSecureCommunication {
  /**
   * @param {DSService} service
   * @param {DSCommunicator} communicator
   */
  constructor (service, communicator) {
    this._emitter = new DSEventEmitter()
    this._service = service
    this._communicator = communicator
    this._users = new Map() // user id to user map
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
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
    const key = await this._communicator.buildKey()
    await this._service.join(key)
    this._service.events.connect('message-received', this._onMessageReceived)
    this._service.events.connect('user-seen', this._onUserSeen)
    this._service.events.connect('user-left', this._onUserLeft)
    this._service.events.connect('user-reset', this._onUserReset)
    this._communicator.events.connect('key-changed', this._onKeyChanged)
  }

  /**
   * Stop the communication.
   */
  async stop () {
    this._communicator.events.disconnect('key-changed', this._onKeyChanged)
    this._service.events.disconnect('user-reset', this._onUserReset)
    this._service.events.disconnect('user-left', this._onUserLeft)
    this._service.events.disconnect('user-seen', this._onUserSeen)
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
      throw new Error('user not found on the service')
    }
    try {
      await this._communicator.acceptKey(to, key)
      this._users.set(to.id, to)
    } catch (e) {
      console.error(e)
      throw new Error(`unable to connect with user ${to.id}`)
    }
  }

  /**
   * Disconnect from a peer.
   * @param {DSUser} from
   */
  async disconnect (from) {
    if (this._users.delete(from.id)) {
      await this._communicator.removeKey(from)
    } else {
      throw new Error(`user ${from.id} was not a peer`)
    }
  }

  /**
   * Get connected users.
   * @returns {Array<DSUser>}
   */
  peers () {
    return [...this._users.values()]
  }

  /**
   * Get all users on the service along with their connectors.
   * @returns {Promise<Array<{user: DSUser, connect: () => Promise<void>}>>}
   */
  async everyone () {
    const array = []
    for (const { user, key } of await this._service.everyone()) {
      const connect = async () => await this.connect(user, key)
      array.push({ user, connect })
    }
    return array
  }

  /**
   * Send message after encrypting it for the user.
   * @param {DSUser} to
   * @param {DSMessage} message
   */
  async send (to, message) {
    try {
      await this._communicator.encrypt(to, message)
      await this._service.send(message, to)
    } catch (e) {
      console.error(e)
      throw new Error(`unable to send message to user ${to.id}`)
    }
  }

  /**
   * Handler for key changed event from communicator.
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
    if (action === 'left') {
      if (this._users.has(user.id)) {
        await this.disconnect(user)
        this._emitter.emit('user-left', user)
      }
    } else if (action === 'seen') {
      if (this._users.has(user.id)) {
        await this.disconnect(user)
      }
      const connect = async () => await this.connect(user, key)
      this._emitter.emit('user-seen', user, connect)
    } else if (action === 'reset') {
      if (this._users.has(user.id)) {
        await this.disconnect(user)
        await this.connect(user, key)
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
      console.log(`Unconnected user ${from.id} trying to send us messages.`)
      return
    }
    try {
      await this._communicator.decrypt(from, message)
      this._emitter.emit('message-received', from, message)
    } catch (e) {
      console.error(e)
      throw new Error(`unable to receive message from user ${from.id}`)
    }
  }
}
