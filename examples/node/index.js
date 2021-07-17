const {
  DSChannelAsService,
  DSChannelWithFilter,
  DSCommunicator,
  DSInMemoryKeystore,
  DSMessage,
  DSNodeCrypto,
  DSPublicKeySystem,
  DSSecretParty,
  DSSharedSecretSystem,
  DSWebtorrentTracker,
  DSWebtorrentTrackerUser
} = require('decent-signal')
const Crypto = require('crypto')
const WebSocket = require('websocket').w3cwebsocket

/**
 * Example for node.
 * The users do not connect if their ids differ by more than 3.
 * The crypto system chosen also depends on the party name.
 */
class Demo {
  /**
   * @param {WebSocket} socket
   * @param {string} peerId
   * @param {string} infoHash
   * @param {string} party
   * @param {string} pass
   */
  constructor (socket, { peerId, infoHash, party, pass }) {
    this._user = new DSWebtorrentTrackerUser(peerId, infoHash, 10)
    const crypto = new DSNodeCrypto(Crypto)
    const store = new DSInMemoryKeystore()
    const system = parseInt(party.replace('party', '')) % 2 === 0
      ? new DSPublicKeySystem(crypto, store)
      : new DSSharedSecretSystem(crypto, store)
    const tracker = new DSWebtorrentTracker(socket, this._user)
    const filter = (from) => {
      const trim = (id) => id.replace('peerIdPrefix-peerId', '')
      const diff = parseInt(trim(this._user.id)) - parseInt(trim(from.id))
      return Math.abs(diff) === 1
    }
    const filtered = new DSChannelWithFilter(tracker, filter)
    const secret = new DSSecretParty(filtered, crypto, { party, pass })
    const service = new DSChannelAsService(secret)
    this._comm = new DSCommunicator(service, system)
    this._onUserFound = (...args) => this._handleFound(...args).then()
    this._onUserLeft = (user) => this._handleLeft(user)
    this._onMessageReceived = (...args) => this._handleMessage(...args)
  }

  /**
   * Start the demo.
   */
  async start () {
    this._comm.events.on('user-join', this._onUserFound)
    this._comm.events.on('user-seen', this._onUserFound)
    this._comm.events.on('user-left', this._onUserLeft)
    this._comm.events.on('message-received', this._onMessageReceived)
    await this._comm.start()
  }

  /**
   * Stop the demo.
   */
  async stop () {
    this._comm.events.off('user-join', this._onUserFound)
    this._comm.events.off('user-seen', this._onUserFound)
    this._comm.events.off('user-left', this._onUserLeft)
    this._comm.events.off('message-received', this._onMessageReceived)
    await this._comm.stop()
  }

  /**
   * Send hello to users found.
   * @param {DSUser} user
   * @param {() => Promise<void>} connect
   */
  async _handleFound (user, connect) {
    console.info(`User ${user.id} found on the service.`)
    await connect()
    console.info(`Connected to user ${user.id}.`)
    const message = new DSMessage(`Hello from user ${this._user.id}!`)
    await this._comm.send(user, message)
  }

  /**
   * Log user left event.
   * @param {DSUser} user
   */
  _handleLeft (user) {
    console.info(`User ${user.id} left the service.`)
  }

  /**
   * Show the incoming message.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  _handleMessage (from, message) {
    console.info(`Got message "${message.data}" from user ${from.id}.`)
  }
}

/**
 * Async main function.
 */
async function main () {
  // Testing with local instance of openwebtorrent-tracker.
  // const socket = new WebSocket('wss://localhost:8000', {}, {}, {}, {}, {
  //   tlsOptions: {
  //     rejectUnauthorized: false
  //   }
  // })
  // Testing with local instance of bittorrent-tracker.
  const socket = new WebSocket('ws://localhost:8000')
  socket.onclose = (event) => {
    console.info(`Socket closed due to ${event.code}: ${event.reason}`)
  }
  await new Promise(resolve => { socket.onopen = (_) => resolve() })
  const demo = new Demo(socket, {
    peerId: 'peerIdPrefix-' + process.argv[2],
    infoHash: 'hashPrefix-' + process.argv[3],
    party: process.argv[4],
    pass: process.argv[5]
  })
  await demo.start()
  setTimeout(async () => {
    await demo.stop()
    socket.close()
  }, 50_000)
}

main().then()
