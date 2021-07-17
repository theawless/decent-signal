import { DSEventEmitter } from '../../utilities/events'

/**
 * @event DSChannelWithFilter#event:message-received
 * @param {DSUser} from
 * @param {DSMessage} message
 */

/**
 * Decorate a channel to add user level filtering.
 * This can have performance benefits as we can encrypt/decrypt lesser.
 * For ChannelAsAService we can also avoid sending keys to unnecessary users.
 * @implements DSChannel
 */
export class DSChannelWithFilter {
  /**
   * @param {DSChannel} channel
   * @param {(DSUser) => boolean} filter
   */
  constructor (channel, filter) {
    this._emitter = new DSEventEmitter()
    this._channel = channel
    this._filter = filter
    this._onMessageReceived = (...args) => this._handleMessage(...args).then()
  }

  get events () {
    return this._emitter
  }

  async join () {
    this._channel.events.on('message-received', this._onMessageReceived)
    await this._channel.join()
  }

  async leave () {
    this._channel.events.off('message-received', this._onMessageReceived)
    await this._channel.leave()
  }

  /**
   * Send message to the channel if not filtered.
   */
  async send (message, to) {
    if (to && !this._filter(to)) {
      throw new Error('cannot send message to a filtered user')
    }
    await this._channel.send(message, to)
  }

  /**
   * Emit the message if it is not filtered.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async _handleMessage (from, message) {
    if (!this._filter(from)) {
      return
    }
    this._emitter.emit('message-received', from, message)
  }
}
