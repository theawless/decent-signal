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
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
  }

  /**
   * @returns {DSEventEmitter}
   */
  get events () {
    return this._emitter
  }

  /**
   * Join the party.
   */
  async join () {
    await this._channel.join()
    this._channel.events.connect('message-received', this._onMessageReceived)
  }

  /**
   * Leave the party.
   */
  async leave () {
    this._channel.events.disconnect('message-received', this._onMessageReceived)
    await this._channel.leave()
  }

  /**
   * Send message to the channel after delaying.
   * @param {DSMessage} message
   * @param {DSUser} [to]
   */
  async send (message, to) {
    await new Promise(resolve => setTimeout(resolve, this._delay))
    await this._channel.send(message, to)
  }

  /**
   * Handler for the incoming messages on the channel.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async _handleMessage (from, message) {
    this._emitter.emit('message-received', from, message)
  }
}
