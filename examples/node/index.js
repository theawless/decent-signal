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
 * Example for node + crypto + public key + webtorrent tracker + party.
 * The setup is such that if the ids of the users differ by more than 1 then
 * they do not connect. The crypto system chosen also depends on the party name.
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
    this._onUserJoin = (user) => this._handleUser(user, 'join').then()
    this._onUserSeen = (user) => this._handleUser(user, 'seen').then()
    this._onUserLeft = (user) => this._handleUser(user, 'left').then()
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
  }

  /**
   * Start the demo.
   */
  async start () {
    await this._comm.start()
    this._comm.events.connect('user-join', this._onUserJoin)
    this._comm.events.connect('user-seen', this._onUserSeen)
    this._comm.events.connect('user-left', this._onUserLeft)
    this._comm.events.connect('message-received', this._onMessageReceived)
  }

  /**
   * Stop the demo.
   */
  async stop () {
    this._comm.events.disconnect('message-received', this._onMessageReceived)
    this._comm.events.disconnect('user-left', this._onUserLeft)
    this._comm.events.disconnect('user-seen', this._onUserSeen)
    this._comm.events.disconnect('user-join', this._onUserJoin)
    await this._comm.stop()
  }

  /**
   * Display the incoming message.
   * @param {DSUser} from
   * @param {DSMessage} message
   */
  async _handleMessage (from, message) {
    console.info(`Got message "${message.data}" from user ${from.id}.`)
  }

  /**
   * Display user activity and respond to it.
   * @param {DSUser} user
   * @param {string} action
   */
  async _handleUser (user, action) {
    console.log(`User ${user.id} action ${action} on the service.`)
    if (action === 'join' || action === 'seen') {
      await this._comm.connect(user)
      console.info(`Connected to user ${user.id}.`)
      const message = new DSMessage(`Hello! from user ${this._user.id}`)
      await this._comm.send(user, message)
    }
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
  socket.onclose = (event) => console.info(`Socket closed due to ${event.code}: ${event.reason}`)
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
