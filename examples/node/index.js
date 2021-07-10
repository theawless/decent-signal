const {
  DSInMemoryKeystore,
  DSChannelAsService,
  DSMessage,
  DSNodeCrypto,
  DSPublicKeyCommunicator,
  DSSharedSecretCommunicator,
  DSSecretParty,
  DSSecureCommunication,
  DSWebtorrentTracker,
  DSWebtorrentTrackerUser
} = require('decent-signal')
const WebSocket = require('websocket').w3cwebsocket
const nodeCrypto = require('crypto')

/**
 * Example for node + crypto + public key + webtorrent tracker + party.
 * The setup is such that if the ids of the users differ by more than 1 then
 * they do not connect. The communicator chosen also depends on the party name.
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
    const crypto = new DSNodeCrypto(nodeCrypto)
    const store = new DSInMemoryKeystore()
    const communicator = parseInt(party.replace('party', '')) % 2 === 0
      ? new DSPublicKeyCommunicator(crypto, store)
      : new DSSharedSecretCommunicator(crypto, store)
    const tracker = new DSWebtorrentTracker(socket, this._user)
    const secret = new DSSecretParty(tracker, crypto, { party, pass })
    const service = new DSChannelAsService(secret)
    this._comm = new DSSecureCommunication(service, communicator)
    this._onUserSeen = (user) => this._handleUser(user, true).then()
    this._onUserLeft = (user) => this._handleUser(user, false).then()
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
  }

  /**
   * Start the demo.
   */
  async start () {
    await this._comm.start()
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
   * @param {boolean} active
   */
  async _handleUser (user, active) {
    if (active) {
      console.info(`User ${user.id} seen on the server.`)
      if (this._shouldConnect(user)) {
        await this._comm.connect(user)
        console.info(`Connected to user ${user.id}.`)
        const message = new DSMessage(`Hello! from user ${this._user.id}`)
        await this._comm.send(user, message)
      } else {
        console.info(`Ignored user ${user.id}.`)
      }
    } else {
      console.info(`User ${user.id} has left the server.`)
    }
  }

  /**
   * If we should connect to the user or not.
   * @param {DSUser} from
   * @returns {boolean}
   */
  _shouldConnect (from) {
    const trim = (id) => id.replace('peerIdPrefix-peerId', '')
    const diff = parseInt(trim(this._user.id)) - parseInt(trim(from.id))
    return Math.abs(diff) === 1
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
  socket.onclose = (evt) => console.info(`Socket closed due to ${evt.code}: ${evt.reason}`)
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
