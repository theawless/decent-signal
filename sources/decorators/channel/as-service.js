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
    this._key = undefined
    this._users = new Map() // user id to user
    this._keys = new Map() // user id to key
    this._onMessageReceived = (...args) => this._handleMessage(...args).then()
  }

  get events () {
    return this._emitter
  }

  /**
   * Join the service by broadcasting a joining message.
   */
  async join (key) {
    this._key = key
    this._channel.events.on('message-received', this._onMessageReceived)
    await this._channel.join()
    const data = JSON.stringify({ type: 'join', data: key.data })
    await this._channel.send(new DSMessage(data))
  }

  /**
   * Leave the service by broadcasting a leaving message.
   */
  async leave () {
    this._channel.events.off('message-received', this._onMessageReceived)
    const data = JSON.stringify({ type: 'left' })
    await this._channel.send(new DSMessage(data))
    await this._channel.leave()
  }

  /**
   * Submit our key by broadcasting it through the channel.
   */
  async submit (key) {
    this._key = key
    const data = JSON.stringify({ type: 'reset', data: key.data })
    await this._channel.send(new DSMessage(data))
  }

  /**
   * Obtain key for an already seen user.
   */
  async obtain (of) {
    return this._keys.get(of.id)
  }

  async send (message, to) {
    message.data = JSON.stringify({ type: 'message', data: message.data })
    await this._channel.send(message, to)
  }

  /**
   * Welcome a user by sending them our key.
   * @param {DSUser} user
   */
  async _welcome (user) {
    const data = JSON.stringify({ type: 'welcome', data: this._key.data })
    await this._channel.send(new DSMessage(data), user)
  }

  /**
   * Take decision based on the type of the message.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async _handleMessage (from, message) {
    const { type, data } = JSON.parse(message.data)
    if (type === 'message') {
      message.data = data
      this._emitter.emit('message-received', from, message)
    } else if (type === 'join') {
      // send our key again so that the new user can know about us
      await this._welcome(from)
      const key = new DSKey(data)
      this._keys.set(from.id, key)
      this._users.set(from.id, from)
      this._emitter.emit('user-join', from, key)
    } else if (type === 'welcome') {
      const key = new DSKey(data)
      this._keys.set(from.id, key)
      this._users.set(from.id, from)
      this._emitter.emit('user-seen', from, key)
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
