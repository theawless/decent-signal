import { DecentSignal } from 'decent-signal'
import { DecentSignalSubtleCrypto } from 'decent-signal-adapter-subtle-crypto'
import { DecentSignalLocalChat, DecentSignalLocalChatUser } from 'decent-signal-adapter-local-chat'

/**
 * Example for browser. See that 1. one channel can have multiple parties 2. nodes with wrong pass cannot join.
 * Serve and open the urls nodes in README to see them perform signalling and then say hi! to each other.
 * Each user rejects to do handshake with a user that is on same priority. If x1 > x2 then x2 is the initiator.
 */
class HelloWorld {
  /**
   * @param {RxDatabaseBase} db
   * @param {string} id
   * @param {number} rank
   * @param {string} party
   * @param {string} pass
   */
  constructor (db, { id, rank, party, pass }) {
    this._crypto = new DecentSignalSubtleCrypto()
    this._user = new DecentSignalLocalChatUser(id, rank)
    this._chat = new DecentSignalLocalChat(db, this._user)
    this._signal = new DecentSignal(this._user, this._chat, this._crypto, { party, pass })
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
    if (this._user.rank - user.rank === 0) {
      console.info(`Skipping handshake for user ${user.id}.`)
      return
    }
    accept()
  }

  /**
   * Create a new peer connection for each node.
   * @param {DecentSignalNode} node
   * @returns {Promise<void>}
   */
  async _handleDiscovery (node) {
    const peer = new window.RTCPeerConnection()
    this._peers.set(node.user.id, peer)
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this._signal.sendSignal(node, JSON.stringify({ ice: event.candidate })).then()
      }
    }
    if (this._user.rank - node.user.rank < 0) { // initiator
      peer.onnegotiationneeded = () => {
        peer.createOffer().then((desc) => this._setupDescription(node, peer, desc).then())
      }
      this._setupChat(peer.createDataChannel('chat'))
    } else {
      peer.ondatachannel = (event) => {
        this._setupChat(event.channel)
      }
    }
  }

  /**
   * Setup local description and send it.
   * @param {DecentSignalNode} node
   * @param {RTCPeerConnection} peer
   * @param {RTCSessionDescription | RTCSessionDescriptionInit} desc
   */
  async _setupDescription (node, peer, desc) {
    await peer.setLocalDescription(desc)
    await this._signal.sendSignal(node, JSON.stringify({ sdp: peer.localDescription }))
  }

  /**
   * Connect to various events of data channel.
   * @param {RTCDataChannel} chat
   */
  _setupChat (chat) {
    chat.onmessage = (event) => console.info(`Got a message: "${event.data}".`)
    chat.onopen = (_) => chat.send(`Hello from ${this._user.id}!`)
  };

  /**
   * Set the remote description or ice candidate when signal arrives from the other node.
   * @param {DecentSignalNode} node
   * @param {string} data
   * @returns {Promise<void>}
   */
  async _handleSignal (node, data) {
    const peer = this._peers.get(node.user.id)
    const message = JSON.parse(data)
    if (message.sdp) {
      await peer.setRemoteDescription(new window.RTCSessionDescription(message.sdp))
      if (peer.remoteDescription.type === 'offer') {
        const desc = await peer.createAnswer()
        await this._setupDescription(node, peer, desc)
      }
    } else if (message.ice) {
      await peer.addIceCandidate(new window.RTCIceCandidate(message.ice))
    } else {
      console.info(`Received weird signalling data from user ${node.user.id}.`)
    }
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
  const db = await RxDB.createRxDatabase({ name: 'channel', adapter: 'idb' })
  const args = new URLSearchParams(window.location.search)
  const demo = new HelloWorld(db, {
    id: args.get('id'),
    rank: parseInt(args.get('rank')),
    party: args.get('party'),
    pass: args.get('pass')
  })
  await demo.start()
  window.addEventListener('beforeunload', (_) => {
    demo.stop().then()
  })
}

main().then()
