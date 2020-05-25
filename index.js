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
    this._handlers.set(event, handlers)
  }
}

/**
 * Abstraction over various encryption methods.
 * Probably won't need verify/sign because we trust the channel for user authentication.
 * The channel should make sure that the sender is who they claim to be.
 * TODO: Should all implementations use the same algorithms? Then we can signal even between node and browser.
 */
export class DecentSignalCryptography {
  /**
   * Generate a secret randomly.
   * @returns {Promise<string>}
   */
  async generateSecret () {}

  /**
   * Encrypt a message with secret.
   * @param {string} secret
   * @param {string} message
   * @returns {Promise<string>}
   */
  async secretEncrypt (secret, message) {}

  /**
   * Decrypt a message with secret.
   * @param {string} secret
   * @param {string} message
   * @returns {Promise<string>}
   */
  async secretDecrypt (secret, message) {}

  /**
   * Generate a public-private key pair.
   * @returns {Promise<{public: string, private: string}>}
   */
  async generateKeyPair () {}

  /**
   * Encrypt a message with public key.
   * @param {string} key
   * @param {string} message
   * @returns {Promise<string>}
   */
  async publicEncrypt (key, message) {}

  /**
   * Decrypt a message with private key.
   * @param {string} key
   * @param {string} message
   * @returns {Promise<string>}
   */
  async privateDecrypt (key, message) {}
}

/**
 * Abstraction over a channel where the signalling information will be exchanged.
 * A channel usually corresponds to a room. In a channel we can make multiple parties.
 * This will help keep the number of channels in check on the channel server.
 * Currently this does not handle joining/creating/leaving/deleting a channel. TODO: Should it be added?
 *
 * The event "message-received" is emitted whenever there's new message in the channel.
 */
export class DecentSignalChannel {
  /**
   * Implementors can use this events field.
   */
  constructor () {
    this.events = new DecentSignalEvents()
  }

  /**
   * Send message to the channel.
   * @param {DecentSignalMessage} message
   * @returns {Promise<void>}
   */
  async sendMessage (message) {}
}

/**
 * Describes how a message should be in the channel.
 */
export class DecentSignalMessage {
  /**
   * @param {string} party
   * @param {DecentSignalUser} to
   * @param {"joined"|"handshake"|"signal"} type
   * @param {string} message
   */
  constructor (party, to, type, message) {
    this.party = party
    this.to = to
    this.type = type
    this.message = message
  }
}

/**
 * Describes a user in the channel.
 */
export class DecentSignalUser {
  /**
   * User id should be unique in the channel.
   * @param {string} id
   */
  constructor (id) {
    this.id = id
  }
}

/**
 * Describes a node in the party.
 */
export class DecentSignalNode {
  /**
   * The private key is undefined for all nodes except the current one.
   * @param {DecentSignalUser} user
   * @param {{public: string, private: string}} key
   */
  constructor (user, key) {
    this.user = user
    this.key = key
  }
}

/**
 * Currently this does not handle connection offer/response creation. TODO: Should it be added?
 *
 * The event "user-seen" is emitted whenever a user is trying to join the party.
 * The event "node-discovered" is emitted whenever there"s new node in the party.
 * The event "signal-received" is emitted whenever a node is sending signalling data.
 *
 * There are no events for node disconnected because:
 * 1. if the node was never connected to then it doesn"t matter if they left
 * 2. if the node was connected then the disconnected event is not a part of signalling data
 *
 * The assumptions for this code are:
 * 1. Only the users that want to join a party know the shared secret (pre shared through other medium)
 * 2. The users within a party can read each others public keys and send encrypted messages to each other
 * 3. All public keys in a party are encrypted using the shared secret
 * 4. The channel makes sure that a user is not pretending to be other user
 */
export class DecentSignal {
  /**
   * @param {DecentSignalUser} user
   * @param {DecentSignalCryptography} crypto
   * @param {DecentSignalChannel} channel
   * @param {{party: string, pass: string}} options
   */
  constructor (user, channel, crypto, options) {
    this.node = new DecentSignalNode(user, undefined)
    this._crypto = crypto
    this._channel = channel
    this._options = options
    this.nodes = new Map() // map of user id to node
    this.events = new DecentSignalEvents()
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
  }

  /**
   * Start the signalling process. The assumptions are that:
   * 1. The channel is already created
   * 2. The user is a member of the channel and can send messages
   * @returns {Promise<void>}
   */
  async startSignalling () {
    this._channel.events.connect('message-received', this._onMessageReceived)
    const [pair] = await Promise.all([
      await this._crypto.generateKeyPair(), await this._sendJoinedNotification()
    ])
    this.node.key = pair
  }

  /**
   * Stop the signalling process.
   * @returns {Promise<void>}
   */
  async stopSignalling () {
    this._channel.events.disconnect('message-received', this._onMessageReceived)
  }

  /**
   * Send current node's joined notification to everyone in the party.
   * The message is data + its encryption. Other nodes can decrypt and verify whether the secret is correct.
   * @returns {Promise<void>}
   */
  async _sendJoinedNotification () {
    const data = await this._crypto.generateSecret()
    const encrypted = await this._crypto.secretEncrypt(this._options.pass, data)
    const message = JSON.stringify({ encrypted: encrypted, data: data })
    await this._channel.sendMessage(new DecentSignalMessage(this._options.party, undefined, 'joined', message))
  }

  /**
   * Send current node's encrypted public key to the user.
   * Note that other nodes can also see this key but it doesn't matter because it's a public key.
   * @param {DecentSignalUser} user
   * @returns {Promise<void>}
   */
  async _sendPublicKey (user) {
    const key = await this._crypto.secretEncrypt(this._options.pass, this.node.key.public)
    await this._channel.sendMessage(new DecentSignalMessage(this._options.party, user, 'handshake', key))
  }

  /**
   * Send signalling data to a node in the party after encryption.
   * @param {DecentSignalNode} node
   * @param {string} data
   * @returns {Promise<void>}
   */
  async sendSignal (node, data) {
    const secret = await this._crypto.generateSecret()
    const results = await Promise.all([
      this._crypto.publicEncrypt(node.key.public, secret),
      this._crypto.secretEncrypt(secret, data)
    ])
    const message = JSON.stringify({ secret: results[0], data: results[1] })
    await this._channel.sendMessage(new DecentSignalMessage(this._options.party, node.user, 'signal', message))
  }

  /**
   * Handler for message received signal from the channel.
   * @param {DecentSignalUser} from
   * @param {DecentSignalMessage} message
   */
  async _handleMessage (from, message) {
    if (message.party !== this._options.party) {
      return
    }
    if (message.to === undefined) {
      if (from.id === this.node.user.id) {
        return
      }
      try {
        await this._handlePartyMessage(from, message)
      } catch (e) {
        console.error(`Error occurred trying to handle party message from user ${from.id}.`)
      }
    } else {
      if (message.to.id !== this.node.user.id) {
        return
      }
      try {
        await this._handleUserMessage(from, message)
      } catch (e) {
        console.error(`Error occurred trying to handle targeted message from user ${from.id}.`)
      }
    }
  }

  /**
   * Handle message that was sent in the party for all users.
   * @param {DecentSignalUser} from
   * @param {DecentSignalMessage} message
   * @returns {Promise<void>}
   */
  async _handlePartyMessage (from, message) {
    if (message.type !== 'joined') {
      console.info(`User ${from.id} is trying to send weird data to all nodes.`)
      return
    }
    const node = this.nodes.get(from.id)
    if (node !== undefined) {
      // TODO: How to handle user retries?
      console.info(`User ${from.id} is trying to send joined notification multiple times.`)
      return
    }
    await this.handleJoinedMessage(from, message)
  }

  /**
   * Handle message that was sent in the party for the current node.
   * @param {DecentSignalUser} from
   * @param {DecentSignalMessage} message
   * @returns {Promise<void>}
   */
  async _handleUserMessage (from, message) {
    const node = this.nodes.get(from.id)
    if (node === undefined) {
      if (message.type !== 'handshake') {
        console.info(`User ${from.id} is sending weird data to our node.`)
        return
      }
      await this.handleHandshakeFirstMessage(from, message)
    } else {
      if (message.type === 'handshake') {
        await this.handleHandshakeSecondMessage(node, message)
      } else if (message.type === 'signal') {
        await this.handleSignalMessage(node, message)
      } else {
        console.info(`User ${from.id} is sending weird data to our node.`)
      }
    }
  }

  /**
   * Handle the joined message and send our user a "user-seen" signal.
   * The user can then choose to use the callback to perform the handshake.
   * @param {DecentSignalUser} from
   * @param {DecentSignalMessage} message
   * @returns {Promise<void>}
   */
  async handleJoinedMessage (from, message) {
    const joined = JSON.parse(message.message)
    const data = await this._crypto.secretDecrypt(this._options.pass, joined.encrypted)
    if (data !== joined.data) {
      console.info(`Either password for user ${from.id} is wrong, or our password is wrong.`)
      return
    }
    const doHandshake = () => {
      this.nodes.set(from.id, new DecentSignalNode(from, undefined))
      this._sendPublicKey(from).then()
    }
    this.events.emit('user-seen', from, doHandshake)
  }

  /**
   * Handle the handshake started message and send our user a "user-seen" signal.
   * The user can then choose to use the callback to perform the handshake.
   * @param {DecentSignalUser} from
   * @param {DecentSignalMessage} message
   * @returns {Promise<void>}
   */
  async handleHandshakeFirstMessage (from, message) {
    const key = await this._crypto.secretDecrypt(this._options.pass, message.message)
    const doHandshake = () => {
      const node = new DecentSignalNode(from, { public: key, private: undefined })
      this.nodes.set(from.id, node)
      this.events.emit('node-discovered', node)
      this._sendPublicKey(from).then()
    }
    this.events.emit('user-seen', from, doHandshake)
  }

  /**
   * Handle the handshake completed message.
   * @param {DecentSignalNode} node
   * @param {DecentSignalMessage} message
   * @returns {Promise<void>}
   */
  async handleHandshakeSecondMessage (node, message) {
    const key = await this._crypto.secretDecrypt(this._options.pass, message.message)
    node.key = { public: key, private: undefined }
    this.events.emit('node-discovered', node)
  }

  /**
   * Handle the signal message from another node.
   * @param {DecentSignalNode} node
   * @param {DecentSignalMessage} message
   * @returns {Promise<void>}
   */
  async handleSignalMessage (node, message) {
    const signal = JSON.parse(message.message)
    const secret = await this._crypto.privateDecrypt(this.node.key.private, signal.secret)
    const data = await this._crypto.secretDecrypt(secret, signal.data)
    this.events.emit('signal-received', node, data)
  }
}
