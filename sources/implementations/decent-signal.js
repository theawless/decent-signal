import { DecentSignalEvents } from '../utilities/events'

/**
 * The entry point for the library. Use this to send and receive messages over the server.
 *
 * The event "user-seen" is emitted when there's a new user on the server.
 * The event "user-left" is emitted when a user leaves the server.
 * The event "message-received" is emitted when there's new message on the server for us.
 */
export class DecentSignal {
  /**
   * @param {DecentSignalCommunicator} communicator
   * @param {DecentSignalServer} server
   */
  constructor (communicator, server) {
    this.events = new DecentSignalEvents()
    this._communicator = communicator
    this._server = server
    this._users = new Map() // user id to user map
    this._onContactInfo = (contact) => this._handleContact(contact).then()
    this._onUserSeen = (from) => this._handleUser(from, 'seen').then()
    this._onUserLeft = (from) => this._handleUser(from, 'left').then()
    this._onUserReset = (from) => this._handleUser(from, 'reset').then()
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
  }

  /**
   * Connect to a user on the server.
   * @param {DecentSignalUser} to
   */
  async connectUser (to) {
    const contact = await this._server.getContact(to)
    await this._communicator.setContact(to, contact)
    this._users.set(to.id, to)
  }

  /**
   * Disconnect from a peer on the server.
   * @param {DecentSignalUser} from
   */
  disconnectPeer (from) {
    this._communicator.removeContact(from)
    this._users.delete(from.id)
  }

  /**
   * Get connected users.
   * @returns {DecentSignalUser[]}
   */
  getPeers () {
    return [...this._users.values()]
  }

  /**
   * Get all users on the server.
   * @returns {Promise<DecentSignalUser[]>}
   */
  async getUsers () {
    return this._server.getUsers()
  }

  /**
   * Start the signalling process.
   */
  async startSignalling () {
    const contact = await this._communicator.getContact()
    await this._server.joinServer(contact)
    this._server.events.connect('user-seen', this._onUserSeen)
    this._server.events.connect('user-left', this._onUserLeft)
    this._server.events.connect('user-reset', this._onUserReset)
    this._server.events.connect('message-received', this._onMessageReceived)
    this._communicator.events.connect('contact-info', this._onContactInfo)
  }

  /**
   * Stop the signalling process.
   */
  async stopSignalling () {
    this._communicator.events.disconnect('contact-info', this._onContactInfo)
    this._server.events.disconnect('message-received', this._onMessageReceived)
    this._server.events.disconnect('user-reset', this._onUserReset)
    this._server.events.disconnect('user-left', this._onUserLeft)
    this._server.events.disconnect('user-seen', this._onUserSeen)
    await this._server.leaveServer()
  }

  /**
   * Send data after encrypting it for the user.
   * @param {DecentSignalUser} to
   * @param {DecentSignalMessage} message
   */
  async sendMessage (to, message) {
    message.text = await this._communicator.encryptText(to, message.text)
    await this._server.sendMessage(to, message)
  }

  /**
   * Handler for contact event from communicator.
   * @param {DecentSignalContact} contact
   */
  async _handleContact (contact) {
    await this._server.setContact(contact)
  }

  /**
   * Handler for user actions on the server.
   * @param {DecentSignalUser} user
   * @param {string} action
   */
  async _handleUser (user, action) {
    if (action === 'seen') {
      this.events.emit('user-seen', user)
    } else if (action === 'reset') {
      if (this._users.has(user.id)) {
        this.disconnectPeer(user)
        await this.connectUser(user)
      }
    } else if (action === 'left') {
      if (this._users.has(user.id)) {
        this.disconnectPeer(user)
        this.events.emit('user-left', user)
      }
    }
  }

  /**
   * Handler for incoming messages on the server.
   * @param {DecentSignalUser} from
   * @param {DecentSignalMessage} message
   */
  async _handleMessage (from, message) {
    if (!this._users.has(from.id)) {
      return
    }
    try {
      message.text = await this._communicator.decryptText(from, message.text)
      this.events.emit('message-received', from, message)
    } catch (e) {
      console.log(`Getting weird data from user ${from.id}.`)
    }
  }
}
