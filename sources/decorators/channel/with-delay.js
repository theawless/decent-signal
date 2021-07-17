import { DSEventEmitter } from '../../utilities/events'

/**
 * @event DSChannelWithDelay#event:message-received
 * @param {DSUser} from
 * @param {DSMessage} message
 */

/**
 * Decorate a channel to add delay in messaging.
 * This can help prevent overloading the channels.
 * @implements DSChannel
 */
export class DSChannelWithDelay {
  /**
   * @param {DSChannel} channel
   * @param {number} delay in milliseconds
   */
  constructor (channel, delay) {
    this._emitter = new DSEventEmitter()
    this._channel = channel
    this._delay = delay
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
   * Send message to the channel after delaying.
   */
  async send (message, to) {
    await new Promise(resolve => setTimeout(resolve, this._delay))
    await this._channel.send(message, to)
  }

  /**
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async _handleMessage (from, message) {
    this._emitter.emit('message-received', from, message)
  }
}
