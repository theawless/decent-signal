import { DecentSignalChat } from '../interfaces/chat'

/**
 * A chat usually corresponds to a room. In a room we can make multiple parties.
 * We can identify a party by name and authenticate the user by password.
 */
export class DecentSignalParty extends DecentSignalChat {
  /**
   * @param {DecentSignalChat} chat
   * @param {DecentSignalCryptography} crypto
   * @param {{party: string, pass: string}} options
   */
  constructor (chat, crypto, options) {
    super()
    this._chat = chat
    this._crypto = crypto
    this._options = options
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
  }

  /**
   * Join the chat.
   */
  async joinChat () {
    await this._chat.joinChat()
    this._chat.events.connect('message-received', this._onMessageReceived)
  }

  /**
   * Leave the chat.
   */
  async leaveChat () {
    this._chat.events.disconnect('message-received', this._onMessageReceived)
    await this._chat.leaveChat()
  }

  /**
   * Send message to the chat after encrypting it for this party.
   * @param {DecentSignalUser | undefined} to
   * @param {DecentSignalMessage} message
   */
  async sendMessage (to, message) {
    const encrypt = await this._crypto.secretEncrypt(this._options.pass, message.text)
    message.text = JSON.stringify({ party: this._options.party, encrypt })
    await this._chat.sendMessage(to, message)
  }

  /**
   * Handler for message received signal from the chat.
   * Only pass on the message if it was encrypted for this party.
   * @param {DecentSignalUser} from
   * @param {DecentSignalMessage} message
   */
  async _handleMessage (from, message) {
    try {
      const { party, encrypt } = JSON.parse(message.text)
      if (party !== this._options.party) {
        return
      }
      message.text = await this._crypto.secretDecrypt(this._options.pass, encrypt)
      this.events.emit('message-received', from, message)
    } catch (e) {
      console.log(`Either user ${from.id} is in the wrong party, or we are.`)
    }
  }
}
