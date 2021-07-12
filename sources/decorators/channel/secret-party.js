import { DSEventEmitter } from '../../utilities/events'

/**
 * @event DSSecretParty#event:message-received
 * @param {DSUser} from
 * @param {DSMessage} message
 */

/**
 * Decorator around a channel to support multiple parties.
 * The user is only allowed at a party if they know the party name and password.
 * @implements DSChannel
 */
export class DSSecretParty {
  /**
   * @param {DSChannel} channel
   * @param {DSCryptography} crypto
   * @param {{party: string, pass: string}} options
   */
  constructor (channel, crypto, options) {
    this._emitter = new DSEventEmitter()
    this._channel = channel
    this._crypto = crypto
    this._options = options
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
   * Send message to the channel after encrypting it for this party.
   * A new secret is created for each message by deriving it from the pass.
   * The salt is also passed along with the message.
   * @param {DSMessage} message
   * @param {DSUser} [to]
   */
  async send (message, to) {
    const salt = await this._crypto.random()
    const key = await this._crypto.secretFromPass(this._options.pass, salt)
    const enc = await this._crypto.secretEncrypt(key, message.data)
    message.data = JSON.stringify({ name: this._options.party, salt, enc })
    await this._channel.send(message, to)
  }

  /**
   * Handler for the incoming messages on the channel.
   * Only pass on the message if it was encrypted for this party.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async _handleMessage (from, message) {
    try {
      const { name, salt, enc } = JSON.parse(message.data)
      if (name !== this._options.party) {
        return
      }
      const key = await this._crypto.secretFromPass(this._options.pass, salt)
      message.data = await this._crypto.secretDecrypt(key, enc)
      this._emitter.emit('message-received', from, message)
    } catch (e) {
      console.log(`User ${from.id} might be in the wrong party.`)
    }
  }
}
