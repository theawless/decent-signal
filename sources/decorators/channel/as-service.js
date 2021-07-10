import { DSKey } from '../../models/key'
import { DSMessage } from '../../models/message'
import { DSEventEmitter } from '../../utilities/event-emitter'

/**
 * @event DSChannelAsService#event:user-seen
 * @param {DSUser} user
 * @param {DSKey} key
 */

/**
 * @event DSChannelAsService#event:user-left
 * @param {DSUser} user
 */

/**
 * @event DSChannelAsService#event:user-reset
 * @param {DSUser} user
 * @param {DSKey} key
 */

/**
 * @event DSChannelAsService#event:message-received
 * @param {DSUser} from
 * @param {DSMessage} message
 */

/**
 * Decorate a channel to act like a service.
 * @implements DSService
 */
export class DSChannelAsService {
  /**
   * @param {DSChannel} channel
   */
  constructor (channel) {
    this._emitter = new DSEventEmitter()
    this._channel = channel
    this._users = new Map() // user id to user map
    this._keys = new Map() // user id to key map
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
  }

  /**
   * @returns {DSEvents}
   */
  get events () {
    return this._emitter
  }

  /**
   * Join the service by broadcasting a joining message.
   * @param {DSKey} key
   */
  async join (key) {
    await this._channel.join()
    this._channel.events.connect('message-received', this._onMessageReceived)
    this._key = key
    const data = JSON.stringify({ type: 'join', data: key.data })
    await this._channel.send(new DSMessage(data))
  }

  /**
   * Leave the service by broadcasting a leaving message.
   */
  async leave () {
    const data = JSON.stringify({ type: 'leave' })
    await this._channel.send(new DSMessage(data))
    this._channel.events.disconnect('message-received', this._onMessageReceived)
    await this._channel.leave()
  }

  /**
   * Submit our key by broadcasting it through the channel.
   * @param {DSKey} key
   */
  async submit (key) {
    this._key = key
    const data = JSON.stringify({ type: 'update', data: key.data })
    await this._channel.send(new DSMessage(data))
  }

  /**
   * Obtain key for an already seen user.
   * @param {DSUser} of
   * @returns {Promise<DSKey | undefined>}
   */
  async obtain (of) {
    return this._keys.get(of.id)
  }

  /**
   * Get seen users in the service along with their keys.
   * @returns {Promise<Array<{user: DSUser, key: DSKey}>>}
   */
  async everyone () {
    const array = []
    for (const user of this._users.values()) {
      const key = this._keys.get(user.id)
      array.add({ user, key })
    }
    return array
  }

  /**
   * Send message to the channel.
   * @param {DSMessage} message
   * @param {DSUser} [to]
   */
  async send (message, to) {
    message.data = JSON.stringify({ type: 'message', data: message.data })
    return this._channel.send(message, to)
  }

  /**
   * Handler for the incoming messages on the channel.
   * Take decision based on the type of the message.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async _handleMessage (from, message) {
    const { type, data } = JSON.parse(message.data)
    if (!type) {
      console.log(`User ${from.id} might be in the wrong channel.`)
      return
    }
    if (type === 'message') {
      message.data = data
      this._emitter.emit('message-received', from, message)
    } else if (type === 'join') {
      // send our key again so that the new user can see us
      await this.submit(this._key)
      this._users.set(from.id, from)
      const key = new DSKey(data)
      this._keys.set(from.id, key)
      this._emitter.emit('user-seen', from, key)
    } else if (type === 'leave') {
      this._keys.delete(from.id)
      this._users.delete(from.id)
      this._emitter.emit('user-left', from)
    } else if (type === 'update') {
      const key = new DSKey(data)
      this._keys.set(from.id, key)
      if (this._users.has(from.id)) {
        this._emitter.emit('user-reset', from, key)
      } else {
        // the user joined before us and already has our key
        this._users.set(from.id, from)
        this._emitter.emit('user-seen', from, key)
      }
    }
  }
}
