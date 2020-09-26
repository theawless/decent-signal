/**
 * Opinionated event emitter for common use. TODO: Find a library?
 */
export class DecentSignalEvents {
  /**
   * The handlers field is a map of event to list of handlers.
   */
  constructor () {
    this._handlers = new Map()
  }

  /**
   * Emit an event by calling all handlers sequentially.
   * @param {string} event
   * @param {...*} args
   */
  emit (event, ...args) {
    for (const handler of this._handlers.get(event) || []) {
      handler(...args)
    }
  }

  /**
   * Connect to an event.
   * The args to handler will be same as the args passed while emitting the event.
   * @param {string} event
   * @param {function(...*): *} handler
   */
  connect (event, handler) {
    this._handlers.set(event, this._handlers.get(event) || [])
    this._handlers.get(event).push(handler)
  }

  /**
   * Disconnect to an event.
   * This should be the same handler that was passed in the connect method.
   * @param {string} event
   * @param {function(...*): void} handler
   */
  disconnect (event, handler) {
    const handlers = this._handlers.get(event).filter((h) => h !== handler)
    if (handlers.length > 0) {
      this._handlers.set(event, handlers)
    } else {
      this._handlers.delete(event)
    }
  }
}

/**
 * Abstraction over various encryption methods.
 * TODO: Force same contract for each method, so we can signal even between node and browser.
 */
export class DecentSignalCryptography {
  /**
   * Generate a secret randomly.
   * @returns {Promise<string>}
   */
  async generateSecret () {}

  /**
   * Encrypt plain text with secret.
   * @param {string} secret
   * @param {string} text
   * @returns {Promise<string>}
   */
  async secretEncrypt (secret, text) {}

  /**
   * Decrypt encrypted text with secret.
   * @param {string} secret
   * @param {string} text
   * @returns {Promise<string>}
   */
  async secretDecrypt (secret, text) {}

  /**
   * Generate a public-private key pair.
   * @returns {Promise<{public: string, private: string}>}
   */
  async generateKeys () {}

  /**
   * Encrypt plain text with public key.
   * @param {string} key
   * @param {string} text
   * @returns {Promise<string>}
   */
  async publicEncrypt (key, text) {}

  /**
   * Decrypt encrypted text with private key.
   * @param {string} key
   * @param {string} text
   * @returns {Promise<string>}
   */
  async privateDecrypt (key, text) {}
}

/**
 * Abstraction over a server where the messages and contact information will be exchanged.
 *
 * The event "user-seen" is emitted when there's a new user on the server.
 * The event "user-left" is emitted when a user leaves the server.
 * The event "user-reset" is emitted when a user resets their contact information.
 * The event "message-received" is emitted when there's new message on the server for us.
 */
export class DecentSignalServer {
  /**
   * Implementors can use the events field.
   */
  constructor () {
    this.events = new DecentSignalEvents()
  }

  /**
   * Set our contact info.
   * @param {DecentSignalContact} contact
   */
  async setContact (contact) {}

  /**
   * Get contact info for a user.
   * @param {DecentSignalUser} of
   * @returns {Promise<DecentSignalContact | undefined>}
   */
  async getContact (of) {}

  /**
   * Get users in the server.
   * @returns {Promise<DecentSignalUser[]>}
   */
  async getUsers () {}

  /**
   * Join the server.
   * @param {DecentSignalContact} contact
   */
  async joinServer (contact) {}

  /**
   * Leave the server.
   */
  async leaveServer () {}

  /**
   * Send message to a user.
   * If to is undefined, it means the message is a broadcast.
   * @param {DecentSignalUser | undefined} to
   * @param {DecentSignalMessage} message
   */
  async sendMessage (to, message) {}
}

/**
 * Describes a user on the server.
 */
export class DecentSignalUser {
  /**
   * User id should be unique on the server.
   * @param {string} id
   */
  constructor (id) {
    this._id = id
  }

  /**
   * @returns {string}
   */
  get id () {
    return this._id
  }
}

/**
 * Describes contact information for a user.
 */
export class DecentSignalContact {
  /**
   * @param {string} info
   */
  constructor (info) {
    this._info = info
  }

  /**
   * @returns {string}
   */
  get info () {
    return this._info
  }
}

/**
 * Describes a message on the server.
 */
export class DecentSignalMessage {
  /**
   * @param {string} text
   */
  constructor (text) {
    this._text = text
  }

  /**
   * @returns {string}
   */
  get text () {
    return this._text
  }

  /**
   * @param {string} text
   */
  set text (text) {
    this._text = text
  }
}

/**
 * Abstraction over a chat where the messages will be exchanged.
 *
 * The event "message-received" is emitted when there's a new message in the chat for us.
 */
export class DecentSignalChat {
  /**
   * Implementors can use the events field.
   */
  constructor () {
    this.events = new DecentSignalEvents()
  }

  /**
   * Join the chat.
   */
  async joinChat () {}

  /**
   * Leave the chat.
   */
  async leaveChat () {}

  /**
   * Send message to a user.
   * If to is undefined, it means the message is a broadcast.
   * @param {DecentSignalUser | undefined} to
   * @param {DecentSignalMessage} message
   */
  async sendMessage (to, message) {}
}

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
      console.log(`Either password for user ${from.id} is wrong, or our password is wrong.`)
    }
  }
}

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

/**
 * List of contacts that we can communicate to and how. TODO: Is this a good name?
 *
 * The event "contact-info" is emitted when our contact information changes.
 */
export class DecentSignalCommunicator {
  /**
   * Implementors can use the events field.
   */
  constructor () {
    this.events = new DecentSignalEvents()
  }

  /**
   * Build our contact information.
   * @returns {DecentSignalContact}
   */
  async getContact () {}

  /**
   * Set contact for a user.
   * @param {DecentSignalUser} of
   * @param {DecentSignalContact} contact
   */
  async setContact (of, contact) {}

  /**
   * Remove contact of a user.
   * @param {DecentSignalUser} of
   */
  removeContact (of) {}

  /**
   * Encrypt plain text for a user.
   * @param {DecentSignalUser} to
   * @param {string} text
   * @returns {Promise<string>}
   */
  async encryptText (to, text) {}

  /**
   * Decrypt encrypted text for a user.
   * @param {DecentSignalUser} from
   * @param {string} text
   * @returns {Promise<string>}
   */
  async decryptText (from, text) {}
}

/**
 * Communicates by encrypting/decrypting with public key cryptography.
 */
export class DecentSignalPublicKeyCommunicator extends DecentSignalCommunicator {
  /**
   * @param {DecentSignalCryptography} crypto
   */
  constructor (crypto) {
    super()
    this._crypto = crypto
    this._keyss = new Map() // user id to keys map
  }

  /**
   * Build our contact information.
   * @returns {DecentSignalContact}
   */
  async getContact () {
    this._keys = await this._crypto.generateKeys()
    const info = JSON.stringify(this._keys)
    return new DecentSignalContact(info)
  }

  /**
   * Set contact for a user.
   * @param {DecentSignalUser} of
   * @param {DecentSignalContact} contact
   */
  async setContact (of, contact) {
    const keys = JSON.parse(contact.info)
    this._keyss.set(of.id, keys)
  }

  /**
   * Remove contact of a user.
   * @param {DecentSignalUser} of
   */
  removeContact (of) {
    this._keyss.delete(of.id)
  }

  /**
   * Encrypt plain text for a user.
   * @param {DecentSignalUser} to
   * @param {string} text
   * @returns {Promise<string>}
   */
  async encryptText (to, text) {
    const keys = this._keyss.get(to.id)
    const secret = await this._crypto.generateSecret()
    const encrypt = await Promise.all([
      this._crypto.publicEncrypt(keys.public, secret),
      this._crypto.secretEncrypt(secret, text)
    ])
    return JSON.stringify({ secret: encrypt[0], text: encrypt[1] })
  }

  /**
   * Decrypt encrypted text for a user.
   * @param {DecentSignalUser} from
   * @param {string} text
   * @returns {Promise<string>}
   */
  async decryptText (from, text) {
    const encrypt = JSON.parse(text)
    const secret = await this._crypto.privateDecrypt(this._keys.private, encrypt.secret)
    return this._crypto.secretDecrypt(secret, encrypt.text)
  }
}

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
