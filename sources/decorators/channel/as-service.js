import { DSKey } from '../../models/key'
import { DSMessage } from '../../models/message'
import { DSEventEmitter } from '../../utilities/events'

/**
 * @event DSChannelAsService#event:user-join
 * @param {DSUser} user
 * @param {DSKey} key
 */

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
 * Every user shares their key as a message in this channel. When a new user
 * joins, the accepting users send their key once again to welcome the user.
 * @implements DSService
 */
export class DSChannelAsService {
  /**
   * @param {DSChannel} channel
   */
  constructor (channel) {
    this._emitter = new DSEventEmitter()
    this._channel = channel
    this._users = new Map() // user id to user
    this._keys = new Map() // user id to key
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
    const data = JSON.stringify({ type: 'left' })
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
    const data = JSON.stringify({ type: 'reset', data: key.data })
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
   * Send message to the channel.
   * @param {DSMessage} message
   * @param {DSUser} [to]
   */
  async send (message, to) {
    message.data = JSON.stringify({ type: 'message', data: message.data })
    await this._channel.send(message, to)
  }

  /**
   * Handler for the incoming messages on the channel.
   * Take decision based on the type of the message.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async _handleMessage (from, message) {
    const { type, data } = JSON.parse(message.data)
    if (type === 'message') {
      if (this._users.has(from.id)) {
        message.data = data
        this._emitter.emit('message-received', from, message)
      }
    } else if (type === 'join') {
      // send our key again so that the new user can know about us
      const message = new DSMessage(JSON.stringify({
        type: 'welcome',
        data: this._key.data
      }))
      await this._channel.send(message)
      const key = new DSKey(data)
      this._keys.set(from.id, key)
      this._users.set(from.id, from)
      this._emitter.emit('user-join', from, key)
    } else if (type === 'welcome') {
      // the user is providing their key to new users
      if (!this._users.has(from.id)) {
        const key = new DSKey(data)
        this._keys.set(from.id, key)
        this._users.set(from.id, from)
        this._emitter.emit('user-seen', from, key)
      }
    } else if (type === 'reset') {
      if (this._users.has(from.id)) {
        const key = new DSKey(data)
        this._keys.set(from.id, key)
        this._emitter.emit('user-reset', from, key)
      }
    } else if (type === 'left') {
      if (this._users.has(from.id)) {
        this._keys.delete(from.id)
        this._users.delete(from.id)
        this._emitter.emit('user-left', from)
      }
    } else {
      console.log(`User ${from.id} might be in the wrong channel.`)
    }
  }
}
