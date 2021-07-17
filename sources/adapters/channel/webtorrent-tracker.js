import { DSMessage } from '../../models/message'
import { DSUser } from '../../models/user'
import { DSEventEmitter } from '../../utilities/events'

/**
 * Describes a user on the webtorrent tracker.
 */
export class DSWebtorrentTrackerUser extends DSUser {
  /**
   * @param {string} peerId 20 byte string
   * @param {string} infoHash 20 byte string
   * @param {number} numWant number of expected users for an infoHash
   */
  constructor (peerId, infoHash, numWant = 5) {
    super(peerId)
    this._peerId = peerId
    this._infoHash = infoHash
    this._numWant = numWant
  }

  /**
   * @returns {string}
   */
  get peerId () {
    return this._peerId
  }

  /**
   * @returns {string}
   */
  get infoHash () {
    return this._infoHash
  }

  /**
   * @returns {number}
   */
  get numWant () {
    return this._numWant
  }
}

/**
 * @event DSWebtorrentTracker#event:message-received
 * @param {DSUser} from
 * @param {DSMessage} message
 */

/**
 * Utilise a webtorrent tracker like a channel. A torrent tracker does not
 * make sure users are authenticated. Hence always use SecretParty with this.
 * @implements DSChannel
 */
export class DSWebtorrentTracker {
  /**
   * The socket should already be connected.
   * @param {WebSocket} socket
   * @param {DSWebtorrentTrackerUser} user
   */
  constructor (socket, user) {
    this._emitter = new DSEventEmitter()
    this._user = user
    this._socket = socket
    this._onMessage = (event) => this._handleMessage(JSON.parse(event.data))
  }

  get events () {
    return this._emitter
  }

  /**
   * Start listening to tracker updates.
   */
  async join () {
    this._announce({ event: 'started' })
    this._socket.addEventListener('message', this._onMessage)
  }

  /**
   * Stop listening to tracker updates.
   */
  async leave () {
    this._socket.removeEventListener('message', this._onMessage)
    this._announce({ event: 'stopped' })
  }

  /**
   * Send message by announcing on the tracker.
   * These trackers help establish webrtc signalling over websockets.
   * They expect that only offers and answers are sent through them,
   * but for our use case we have hack-ily sent our encrypted messages.
   */
  async send (message, to) {
    if (to) {
      this._announce({ to_peer_id: to.id, answer: message.data })
    } else {
      // just broadcast the same message to everybody
      const offers = Array(this._user.numWant).fill({
        offer: { sdp: message.data }, offer_id: 'NotSoRandom'
      })
      this._announce({ offers })
    }
  }

  /**
   * Announce action on the tracker.
   * @param {object} opts
   */
  _announce (opts) {
    const defaultOpts = {
      action: 'announce',
      peer_id: this._user.peerId,
      info_hash: this._user.infoHash,
      numwant: this._user.numWant
    }
    const allOpts = { ...defaultOpts, ...opts }
    this._socket.send(JSON.stringify(allOpts))
  }

  /**
   * Emit the message if it is meant for us.
   * @param {object} data
   */
  _handleMessage (data) {
    if (data.info_hash !== this._user.infoHash) {
      return
    }
    if (!data.peer_id || data.peer_id === this._user.peerId) {
      return
    }
    const from = new DSUser(data.peer_id)
    if (data.offer && data.offer.sdp) {
      const message = new DSMessage(data.offer.sdp)
      this._emitter.emit('message-received', from, message)
    } else if (data.answer) {
      const message = new DSMessage(data.answer)
      this._emitter.emit('message-received', from, message)
    } else {
      console.log(`User ${from.id} is sending ill-formed message.`)
    }
  }
}
