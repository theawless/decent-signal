/**
 * Example for browser. See that 1. one channel can have multiple parties 2. nodes with wrong pass cannot join.
 * Serve and open the urls nodes in README to see them perform signalling and then say hi! to each other.
 * Each user rejects to do handshake with a user that is on same priority. If x1 > x2 then x2 is the initiator.
 */
class HelloWorld {
  /**
   * @param {MatrixClient} client
   * @param {string} room
   * @param {string} party
   * @param {string} pass
   */
  constructor (client, { room, party, pass }) {
    this._crypto = new window.decentSignal.DecentSignalSubtleCrypto()
    this._user = new window.decentSignal.DecentSignalUser(client.getUserId())
    this._chat = new window.decentSignal.DecentSignalMatrixChat(client, room)
    this._signal = new window.decentSignal.DecentSignal(this._user, this._chat, this._crypto, { party, pass })
    this._peers = new Map() // map of user id to peer
    this._onUserSeen = (user, accept) => this._handleSeen(user, accept).then()
    this._onNodeDiscovery = (node) => this._handleDiscovery(node).then()
    this._onSignalReceived = (node, data) => this._handleSignal(node, data).then()
  }

  /**
   * Start the demo.
   * @returns {Promise<void>}
   */
  async start () {
    await this._chat.startListening()
    await this._signal.startSignalling()
    this._signal.events.connect('user-seen', this._onUserSeen)
    this._signal.events.connect('node-discovered', this._onNodeDiscovery)
    this._signal.events.connect('signal-received', this._onSignalReceived)
  }

  /**
   * Stop the demo.
   * @returns {Promise<void>}
   */
  async stop () {
    this._signal.events.disconnect('signal-received', this._onSignalReceived)
    this._signal.events.disconnect('node-discovered', this._onNodeDiscovery)
    this._signal.events.disconnect('user-seen', this._onUserSeen)
    await this._signal.stopSignalling()
    await this._chat.stopListening()
  }

  /**
   * Decide whether we want to do handshake with the user.
   * @param {DecentSignalLocalChatUser} user
   * @param {function():void} accept
   * @returns {Promise<void>}
   */
  async _handleSeen (user, accept) {
    accept()
  }

  /**
   * Create a new peer connection for each node.
   * @param {DecentSignalNode} node
   * @returns {Promise<void>}
   */
  async _handleDiscovery (node) {
    const peer = new SimplePeer({ initiator: this._user.id < node.user.id })
    this._peers.set(node.user.id, peer)
    peer.on('signal', (data) => {
      this._signal.sendSignal(node, JSON.stringify(data)).then()
    })
    peer.on('connect', () => {
      peer.send(`Hello from ${this._user.id}!`)
    })
    peer.on('data', data => {
      console.info(`Got a message: "${data}".`)
    })
  }

  /**
   * Pass the signalling data to simple peer.
   * @param {DecentSignalNode} node
   * @param {string} data
   * @returns {Promise<void>}
   */
  async _handleSignal (node, data) {
    const peer = this._peers.get(node.user.id)
    peer.signal(JSON.parse(data))
  }
}

/**
 * Log to the console widget on the page.
 * @param {...*} args
 */
console.info = function (...args) {
  const message = args.map(x => typeof x === 'object' ? JSON.stringify(x) : x)
  document.getElementById('console').textContent += message + '\n'
}

/**
 * Async main function.
 * @returns {Promise<void>}
 */
async function main () {
  const room = '!amsfoHspuicqIckjff:matrix.org' // #decent-signal-demo:matrix.org room
  const args = new URLSearchParams(window.location.search)
  const client = window.matrixcs.createClient('https://matrix.org')
  await client.login('m.login.password', { 'user': args.get('loginId'), 'password': args.get('loginPass') })
  await client.startClient({ initialSyncLimit: 0, lazyLoadMembers: true })
  await client.joinRoom(room)
  const demo = new HelloWorld(client, { room, party: args.get('party'), pass: args.get('pass') })
  await demo.start()
  window.onbeforeunload = () => {
    demo.stop().then()
    client.leave(room).then()
    return ''
  }
}

main().then()
