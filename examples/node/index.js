const {
  DecentSignalPublicKeyCommunicator,
  DecentSignal,
  DecentSignalParty,
  DecentSignalChannel,
  DecentSignalUser,
  DecentSignalMessage
} = require('decent-signal')
const {
  DecentSignalWebtorrentTracker,
  DecentSignalWebtorrentTrackerUser
} = require('decent-signal-adapter-webtorrent-tracker')
const { DecentSignalNodeCrypto } = require('decent-signal-adapter-node-crypto')
const WebSocket = require('websocket').w3cwebsocket

/**
 * Example for node + crypto + public key communication + webtorrent tracker as a channel + party system.
 * The setup is such that if the ids of the users differ by more than 1 then they do not connect.
 * Notice that nodes with wrong pass cannot join a party.
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
    this._user = new DecentSignalWebtorrentTrackerUser(peerId, infoHash)
    const crypto = new DecentSignalNodeCrypto()
    const communicator = new DecentSignalPublicKeyCommunicator(crypto)
    const local = new DecentSignalWebtorrentTracker(socket, this._user)
    const chat = new DecentSignalParty(local, crypto, { party, pass })
    const server = new DecentSignalChannel(chat)
    this._signal = new DecentSignal(communicator, server)
    this._onUserSeen = (user) => this._handleUser(user, true).then()
    this._onUserLeft = (user) => this._handleUser(user, false).then()
    this._onMessageReceived = (from, message) => this._handleMessage(from, message).then()
  }

  /**
   * Start the demo.
   */
  async start () {
    await this._signal.startSignalling()
    this._signal.events.connect('user-seen', this._onUserSeen)
    this._signal.events.connect('user-left', this._onUserLeft)
    this._signal.events.connect('message-received', this._onMessageReceived)
  }

  /**
   * Stop the demo.
   */
  async stop () {
    this._signal.events.disconnect('message-received', this._onMessageReceived)
    this._signal.events.disconnect('user-left', this._onUserLeft)
    this._signal.events.disconnect('user-seen', this._onUserSeen)
    await this._signal.stopSignalling()
  }

  /**
   * Display the incoming message.
   * @param {DecentSignalUser} from
   * @param {DecentSignalMessage} message
   */
  async _handleMessage (from, message) {
    console.info(`Got message "${message.text}" from user ${from.id}.`)
  }

  /**
   * Display user activity and respond to it.
   * @param {DecentSignalUser} from
   * @param {boolean} active
   */
  async _handleUser (from, active) {
    if (active) {
      console.info(`User ${from.id} seen on the server.`)
      if (this._shouldConnect(from)) {
        await this._signal.connectUser(from)
        console.info(`Connected to user ${from.id}.`)
        const message = new DecentSignalMessage(`Hello! from ${this._user.id}`)
        await this._signal.sendMessage(from, message)
      } else {
        console.info(`Ignored user ${from.id}.`)
      }
    } else {
      console.info(`User ${from.id} has left the server.`)
    }
  }

  /**
   * If we should connect to the user or not.
   * @param {DecentSignalUser} from
   * @returns {boolean}
   */
  _shouldConnect (from) {
    const a = this._user.id.replace('peerIdPrefix-peerId', '')
    const b = from.id.replace('peerIdPrefix-peerId', '')
    return Math.abs(parseInt(a) - parseInt(b)) === 1
  }
}

/**
 * Async main function.
 */
async function main () {
  const socket = new WebSocket('ws://localhost:8000')
  await new Promise(resolve => {
    socket.onopen = (_) => {
      resolve()
    }
  })
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
