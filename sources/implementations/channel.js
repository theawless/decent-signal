import { DecentSignalContact, DecentSignalMessage } from '../interfaces/models'
import { DecentSignalServer } from '../interfaces/server'

/**
 * A server that has no history of users or messages.
 */
export class DecentSignalChannel extends DecentSignalServer {
  /**
   * @param {DecentSignalChat} chat
   */
  constructor (chat) {
    super()
    this._chat = chat
    this._users = new Map() // user id to user map
    this._contacts = new Map() // user id to contact map
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
  }

  /**
   * Set our contact info.
   * @param {DecentSignalContact} contact
   */
  async setContact (contact) {
    this._contact = contact
    const text = JSON.stringify({ type: 'contact-info', text: contact.info })
    await this._chat.sendMessage(undefined, new DecentSignalMessage(text))
  }

  /**
   * Get contact info for a user.
   * @param {DecentSignalUser} of
   * @returns {Promise<DecentSignalContact | undefined>}
   */
  async getContact (of) {
    return this._contacts.get(of.id)
  }

  /**
   * Get users seen until now in the chat.
   * @returns {Promise<DecentSignalUser[]>}
   */
  async getUsers () {
    return [...this._users.values()]
  }

  /**
   * Join the server by broadcasting a joining message.
   * @param {DecentSignalContact} contact
   */
  async joinServer (contact) {
    await this._chat.joinChat()
    this._chat.events.connect('message-received', this._onMessageReceived)
    this._contact = contact
    const text = JSON.stringify({ type: 'joining', text: contact.info })
    await this._chat.sendMessage(undefined, new DecentSignalMessage(text))
  }

  /**
   * Leave the server by broadcasting a leaving message.
   */
  async leaveServer () {
    const text = JSON.stringify({ type: 'leaving' })
    await this._chat.sendMessage(undefined, new DecentSignalMessage(text))
    this._chat.events.disconnect('message-received', this._onMessageReceived)
    await this._chat.leaveChat()
  }

  /**
   * Send message to a user.
   * @param {DecentSignalUser | undefined} to
   * @param {DecentSignalMessage} message
   */
  async sendMessage (to, message) {
    message.text = JSON.stringify({ type: 'message', text: message.text })
    await this._chat.sendMessage(to, message)
  }

  /**
   * Handler for the incoming messages in the chat.
   * @param {DecentSignalUser} from
   * @param {DecentSignalMessage} message
   */
  async _handleMessage (from, message) {
    const { type, text } = JSON.parse(message.text)
    if (type === 'message') {
      message.text = text
      this.events.emit('message-received', from, message)
    } else if (type === 'joining') {
      // send our contact again so that the new user can see us
      await this.setContact(this._contact)

      this._users.set(from.id, from)
      this._contacts.set(from.id, new DecentSignalContact(text))
      this.events.emit('user-seen', from)
    } else if (type === 'leaving') {
      this.events.emit('user-left', from)
      this._contacts.delete(from.id)
      this._users.delete(from.id)
    } else if (type === 'contact-info') {
      this._contacts.set(from.id, new DecentSignalContact(text))
      if (this._users.has(from.id)) {
        this.events.emit('user-reset', from)
      } else {
        // the user joined before us and already has our contact
        this._users.set(from.id, from)
        this.events.emit('user-seen', from)
      }
    }
  }
}
